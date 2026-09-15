"""Backend unit tests (no network). Run: pytest"""
from monitor import aws
from monitor.base import mtd_factor, parse_time


def test_sigv4_header_shape():
    h = aws.sigv4_headers(
        "POST", "https://ec2.us-east-1.amazonaws.com/", "ec2", "us-east-1",
        "AKID", "SECRET", b"Action=DescribeInstances&Version=2016-11-15")
    assert h["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=AKID/")
    assert "x-amz-date" in h


def test_parse_ec2_instances():
    xmlb = (b'<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">'
            b'<reservationSet><item><instancesSet><item>'
            b'<instanceId>i-123</instanceId><instanceType>t3.micro</instanceType>'
            b'<instanceState><name>running</name></instanceState>'
            b'<placement><availabilityZone>us-east-1a</availabilityZone></placement>'
            b'<tagSet><item><key>Name</key><value>web</value></item></tagSet>'
            b'</item></instancesSet></item></reservationSet></DescribeInstancesResponse>')
    items = aws._parse_ec2_instances(xmlb)
    assert items[0]["id"] == "i-123"
    assert items[0]["name"] == "web"
    assert items[0]["state"] == "running"


def test_mtd_factor_bounds():
    assert 0.0 <= mtd_factor(parse_time("2020-01-01T00:00:00Z")) <= 1.0
    assert mtd_factor(parse_time("2999-01-01T00:00:00Z")) == 0.0
