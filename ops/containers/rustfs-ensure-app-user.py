#!/usr/bin/env python3
"""Create a bucket-scoped RustFS IAM user for the all-in-one app process (ZA-05).

Reads admin + app credentials from environment; never prints secret values.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signed_request(
    *,
    method: str,
    endpoint: str,
    path: str,
    query: dict[str, str],
    body: bytes,
    access_key: str,
    secret_key: str,
) -> None:
    region = "us-east-1"
    service = "s3"
    url = urllib.parse.urlparse(endpoint)
    host = url.netloc
    items = sorted(query.items())
    canonical_query = urllib.parse.urlencode(items, quote_via=urllib.parse.quote)
    payload_hash = sha256_hex(body)
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    datestamp = now.strftime("%Y%m%d")
    canonical_headers = (
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_request = "\n".join(
        [method, path, canonical_query, canonical_headers, signed_headers, payload_hash]
    )
    credential_scope = f"{datestamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join(
        ["AWS4-HMAC-SHA256", amz_date, credential_scope, sha256_hex(canonical_request.encode())]
    )
    k_date = sign(("AWS4" + secret_key).encode("utf-8"), datestamp)
    k_region = sign(k_date, region)
    k_service = sign(k_region, service)
    k_signing = sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    request_url = f"{endpoint.rstrip('/')}{path}"
    if canonical_query:
        request_url = f"{request_url}?{canonical_query}"
    headers = {
        "Authorization": authorization,
        "Host": host,
        "X-Amz-Content-Sha256": payload_hash,
        "X-Amz-Date": amz_date,
    }
    if body:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(request_url, data=body or None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"RUSTFS_ADMIN_{response.status}")
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"RUSTFS_ADMIN_{error.code}") from error


def main() -> int:
    endpoint = os.environ["ZOEN_S3_ENDPOINT"].rstrip("/")
    bucket = os.environ.get("ZOEN_S3_BUCKET", "zoen")
    admin_access = os.environ["ZOEN_S3_ADMIN_ACCESS_KEY"]
    admin_secret = os.environ["ZOEN_S3_ADMIN_SECRET_KEY"]
    app_access = os.environ["ZOEN_S3_APP_ACCESS_KEY"]
    app_secret = os.environ["ZOEN_S3_APP_SECRET_KEY"]
    policy_name = "zoen-app-bucket"
    policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "s3:AbortMultipartUpload",
                    "s3:DeleteObject",
                    "s3:GetBucketLocation",
                    "s3:GetBucketVersioning",
                    "s3:GetObject",
                    "s3:GetObjectLegalHold",
                    "s3:GetObjectRetention",
                    "s3:GetObjectVersion",
                    "s3:ListBucket",
                    "s3:ListBucketMultipartUploads",
                    "s3:ListBucketVersions",
                    "s3:ListMultipartUploadParts",
                    "s3:PutObject",
                ],
                "Resource": [f"arn:aws:s3:::{bucket}", f"arn:aws:s3:::{bucket}/*"],
            }
        ],
    }
    signed_request(
        method="PUT",
        endpoint=endpoint,
        path="/rustfs/admin/v3/add-canned-policy",
        query={"name": policy_name},
        body=json.dumps(policy_document, separators=(",", ":")).encode(),
        access_key=admin_access,
        secret_key=admin_secret,
    )
    signed_request(
        method="PUT",
        endpoint=endpoint,
        path="/rustfs/admin/v3/add-user",
        query={"accessKey": app_access},
        body=json.dumps({"secretKey": app_secret, "status": "enabled"}, separators=(",", ":")).encode(),
        access_key=admin_access,
        secret_key=admin_secret,
    )
    signed_request(
        method="PUT",
        endpoint=endpoint,
        path="/rustfs/admin/v3/set-user-or-group-policy",
        query={
            "isGroup": "false",
            "policyName": policy_name,
            "userOrGroup": app_access,
        },
        body=b"",
        access_key=admin_access,
        secret_key=admin_secret,
    )
    print("rustfs-ensure-app-user: ok", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 — surface code only
        print(f"rustfs-ensure-app-user: {error}", file=sys.stderr)
        raise SystemExit(1)
