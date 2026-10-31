#!/usr/bin/env bash
# Creates the saga queues, with the same names and settings as the AWS ones
# (ADR-015), so local runs change only the endpoint. LocalStack runs this file
# from /etc/localstack/init/ready.d once SQS is up.
set -euo pipefail

ACCOUNT="000000000000"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
attributes="$(mktemp)"
trap 'rm -f "$attributes"' EXIT

for name in billing-commands execution-commands saga-replies; do
  queue="car-repair-shop-${name}.fifo"
  dlq="car-repair-shop-${name}-dlq.fifo"

  awslocal sqs create-queue --queue-name "$dlq" \
    --attributes FifoQueue=true,MessageRetentionPeriod=1209600 > /dev/null

  cat > "$attributes" <<JSON
{
  "FifoQueue": "true",
  "ContentBasedDeduplication": "false",
  "VisibilityTimeout": "30",
  "ReceiveMessageWaitTimeSeconds": "20",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:${REGION}:${ACCOUNT}:${dlq}\",\"maxReceiveCount\":\"5\"}"
}
JSON
  awslocal sqs create-queue --queue-name "$queue" --attributes "file://${attributes}" > /dev/null

  echo "created ${queue} and ${dlq}"
done
