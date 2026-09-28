# Sends the reviewed bootstrap script to the specific EC2 instance through SSM.
param(
    [string]$Profile = 'smart-building-deploy',
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ImageTag = 'fb0cbf74448d69b201d6187871f4251866e57202'
)
$ErrorActionPreference = 'Stop'
$region = 'us-east-2'
$instanceId = 'i-0ac056f3c25c1949a'
$accountId = & aws sts get-caller-identity --profile $Profile --region $region --query Account --output text
if ($LASTEXITCODE -ne 0) { throw 'Authenticate the local AWS CLI profile first' }
if ($accountId.Trim() -ne '473247067977') { throw 'Unexpected AWS account' }

$ssmState = & aws ssm describe-instance-information --profile $Profile --region $region --filters "Key=InstanceIds,Values=$instanceId" --query 'InstanceInformationList[0].PingStatus' --output text
if ($LASTEXITCODE -ne 0 -or $ssmState.Trim() -ne 'Online') { throw 'Target instance is not online in SSM' }

$script = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'bootstrap-ec2.sh')).Replace("`r`n", "`n")
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
$parameters = @{
    commands = @(
        'set -eu',
        'install -m 0700 -d /opt/smart-building-deploy',
        "printf '%s' '$encoded' | base64 --decode > /opt/smart-building-deploy/bootstrap.sh",
        'chmod 0700 /opt/smart-building-deploy/bootstrap.sh',
        "bash /opt/smart-building-deploy/bootstrap.sh '$ImageTag'"
    )
    executionTimeout = @('900')
}
$parametersFile = Join-Path ([IO.Path]::GetTempPath()) ('smart-building-ssm-' + [guid]::NewGuid().ToString('N') + '.json')
try {
    [IO.File]::WriteAllText($parametersFile, ($parameters | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    $commandId = & aws ssm send-command --profile $Profile --region $region --instance-ids $instanceId --document-name AWS-RunShellScript --parameters "file://$parametersFile" --timeout-seconds 60 --comment 'Smart Building initial Compose rollout' --query Command.CommandId --output text
    if ($LASTEXITCODE -ne 0) { throw 'SSM command submission failed' }
    Write-Output "SSM Command ID: $commandId"
    Write-Output "Inspect with: aws ssm get-command-invocation --profile $Profile --region $region --instance-id $instanceId --command-id $commandId"
} finally {
    if (Test-Path -LiteralPath $parametersFile) { Remove-Item -LiteralPath $parametersFile -Force }
}
