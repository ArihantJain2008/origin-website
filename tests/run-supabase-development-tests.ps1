$ErrorActionPreference = "Stop"

function Read-HiddenValue([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$projectRef = Read-Host "Development Supabase project reference"
$projectUrl = Read-Host "Development Supabase project URL"
$confirmation = Read-Host "After checking the dashboard project name, type exactly origin-development to continue"
if ($confirmation -cne "origin-development") {
  throw "The development project name was not confirmed. No credentials were requested and no tests were run."
}
$anonKey = Read-HiddenValue "Development anon/publishable key"
$serviceKey = Read-HiddenValue "Development service-role/secret key"

if ($projectUrl -notmatch "^https://$([regex]::Escape($projectRef))\.supabase\.co$") {
  throw "The URL does not match the supplied project reference. No tests were run."
}

$env:ORIGIN_SUPABASE_ENV = "development"
$env:ORIGIN_DEV_CONFIRM_NAME = $confirmation
$env:ORIGIN_RUN_SUPABASE_INTEGRATION = "1"
$env:ORIGIN_DEV_PROJECT_REF = $projectRef
$env:ORIGIN_DEV_SUPABASE_URL = $projectUrl
$env:ORIGIN_DEV_SUPABASE_ANON_KEY = $anonKey
$env:ORIGIN_DEV_SUPABASE_SERVICE_ROLE_KEY = $serviceKey

$testExitCode = 0
try {
  npm.cmd test
  $testExitCode = $LASTEXITCODE
}
finally {
  @("ORIGIN_SUPABASE_ENV", "ORIGIN_DEV_CONFIRM_NAME", "ORIGIN_RUN_SUPABASE_INTEGRATION", "ORIGIN_DEV_PROJECT_REF", "ORIGIN_DEV_SUPABASE_URL", "ORIGIN_DEV_SUPABASE_ANON_KEY", "ORIGIN_DEV_SUPABASE_SERVICE_ROLE_KEY") | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
  $anonKey = $null
  $serviceKey = $null
  [GC]::Collect()
}
exit $testExitCode
