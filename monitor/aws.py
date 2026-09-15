"""AWS via stdlib SigV4 (no boto3). Docs: docs.aws.amazon.com (EC2/RDS/ELBv2/S3/CE query+JSON APIs).

Token format in config.toml: token = "ACCESS_KEY:SECRET_KEY[:REGION]"
(default region us-east-1). Cost aspect: Cost Explorer MTD UnblendedCost
total + per-service breakdown stored as service=billing rows; inventory
rows carry cost 0.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


def _sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def sigv4_headers(method, url, service, region, ak, sk, body=b"", extra=None, target=None):
    t = dt.datetime.now(dt.timezone.utc)
    amzdate, datestamp = t.strftime("%Y%m%dT%H%M%SZ"), t.strftime("%Y%m%d")
    u = urllib.parse.urlparse(url)
    host = u.netloc
    if method == "GET" and u.query:
        qs_params = urllib.parse.parse_qsl(u.query, keep_blank_values=True)
    else:
        qs_params = []
    payload_hash = hashlib.sha256(body).hexdigest()
    headers = {"host": host, "x-amz-date": amzdate}
    if target:
        headers["x-amz-target"] = target
        headers["content-type"] = "application/x-amz-json-1.1"
    if extra:
        headers.update(extra)
    if method == "POST" and body and "content-type" not in headers:
        headers["content-type"] = "application/x-www-form-urlencoded; charset=utf-8"
    signed = ";".join(sorted(headers))
    canonical = "\n".join([
        method, u.path or "/",
        "&".join(f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}"
                 for k, v in sorted(qs_params)),
        "\n".join(f"{k}:{headers[k]}" for k in sorted(headers)) + "\n",
        signed, payload_hash,
    ])
    scope = f"{datestamp}/{region}/{service}/aws4_request"
    to_sign = "\n".join(["AWS4-HMAC-SHA256", amzdate, scope,
                         hashlib.sha256(canonical.encode()).hexdigest()])
    k = _sign(b"AWS4" + sk.encode(), datestamp)
    k = _sign(k, region); k = _sign(k, service); k = _sign(k, "aws4_request")
    sig = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
    headers["Authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={ak}/{scope}, SignedHeaders={signed}, Signature={sig}")
    return headers


def _post_query(endpoint, service, region, ak, sk, action, version, extra_params=None):
    params = {"Action": action, "Version": version}
    params.update(extra_params or {})
    body = urllib.parse.urlencode(params).encode()
    headers = sigv4_headers("POST", endpoint, service, region, ak, sk, body)
    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def _parse_ec2_instances(xml_bytes):
    ns = {"e": "http://ec2.amazonaws.com/doc/2016-11-15/"}
    root = ET.fromstring(xml_bytes)
    out = []
    for item in root.findall(".//e:instancesSet/e:item", ns):
        def txt(p):
            el = item.find(p, ns)
            return el.text if el is not None else ""
        out.append({
            "id": txt("e:instanceId"), "type": txt("e:instanceType"),
            "state": txt("e:instanceState/e:name"), "az": txt("e:placement/e:availabilityZone"),
            "name": next((t.find("e:value", ns).text for t in item.findall("e:tagSet/e:item", ns)
                          if t.find("e:key", ns) is not None
                          and t.find("e:key", ns).text == "Name"
                          and t.find("e:value", ns) is not None), txt("e:instanceId")),
        })
    return out


def _ce_mtd(ak, sk):
    """Returns (total, [(service, amount)]) for current month."""
    endpoint = "https://ce.us-east-1.amazonaws.com/"
    now = dt.datetime.now(dt.timezone.utc)
    body = json.dumps({
        "TimePeriod": {"Start": now.strftime("%Y-%m-01"), "End": now.strftime("%Y-%m-%d")},
        "Granularity": "MONTHLY", "Metrics": ["UnblendedCost"],
        "GroupBy": [{"Type": "DIMENSION", "Key": "SERVICE"}],
    }).encode()
    headers = sigv4_headers("POST", endpoint, "ce", "us-east-1", ak, sk, body,
                            target="AWSOrigamiService_v20190101.GetCostAndUsage")
    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode())
    groups = []
    total = 0.0
    for res in data.get("ResultsByTime", []):
        total += float(res.get("Total", {}).get("UnblendedCost", {}).get("Amount", 0) or 0)
        for g in res.get("Groups", []):
            svc = " ".join(g.get("Keys", []))
            amt = float(g.get("Metrics", {}).get("UnblendedCost", {}).get("Amount", 0) or 0)
            groups.append((svc, round(amt, 4)))
    return round(total, 4), groups


def collect(account, token):
    parts = token.split(":")
    ak, sk = parts[0], parts[1] if len(parts) > 1 else ""
    region = parts[2] if len(parts) > 2 else "us-east-1"
    rows = []

    try:
        xmlb = _post_query(f"https://ec2.{region}.amazonaws.com/", "ec2", region,
                           ak, sk, "DescribeInstances", "2016-11-15")
        for i in _parse_ec2_instances(xmlb):
            rows.append({
                "provider": "aws", "account": account, "service": "ec2",
                "resource_id": i["id"], "name": i["name"], "region": i["az"],
                "status": i["state"], "cost_mtd": 0.0,
                "tags": {"instance_type": i["type"]}, "raw": {"type": i["type"]},
            })
    except Exception as e:
        rows.append({"provider": "aws", "account": account, "service": "api_error",
                     "resource_id": "ec2", "name": "ec2", "region": region,
                     "status": "error", "cost_mtd": 0.0,
                     "tags": {"error": str(e)[:200]}, "raw": {}})

    try:
        xmlb = _post_query(f"https://rds.{region}.amazonaws.com/", "rds", region,
                           ak, sk, "DescribeDBInstances", "2014-10-31")
        root = ET.fromstring(xmlb)
        ns = {"e": "http://rds.amazonaws.com/doc/2014-10-31/"}
        for item in root.findall(".//e:DBInstance", ns):
            def txt(p):
                el = item.find(p, ns)
                return el.text if el is not None else ""
            rows.append({
                "provider": "aws", "account": account, "service": "rds",
                "resource_id": txt("e:DBInstanceIdentifier"), "name": txt("e:DBInstanceIdentifier"),
                "region": region, "status": txt("e:DBInstanceStatus"), "cost_mtd": 0.0,
                "tags": {"class": txt("e:DBInstanceClass"), "engine": txt("e:Engine")}, "raw": {},
            })
    except Exception as e:
        rows.append({"provider": "aws", "account": account, "service": "api_error",
                     "resource_id": "rds", "name": "rds", "region": region,
                     "status": "error", "cost_mtd": 0.0,
                     "tags": {"error": str(e)[:200]}, "raw": {}})

    try:
        total, groups = _ce_mtd(ak, sk)
        rows.append({"provider": "aws", "account": account, "service": "billing",
                     "resource_id": "ce:total", "name": "MTD UnblendedCost",
                     "region": "", "status": "", "cost_mtd": total, "tags": {}, "raw": {}})
        for svc, amt in sorted(groups, key=lambda x: -x[1])[:20]:
            rows.append({"provider": "aws", "account": account, "service": "billing",
                         "resource_id": f"ce:{svc}", "name": svc,
                         "region": "", "status": "", "cost_mtd": amt, "tags": {}, "raw": {}})
    except Exception as e:
        rows.append({"provider": "aws", "account": account, "service": "api_error",
                     "resource_id": "ce", "name": "ce", "region": "",
                     "status": "error", "cost_mtd": 0.0,
                     "tags": {"error": str(e)[:200]}, "raw": {}})
    return rows
