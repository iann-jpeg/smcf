# PowerShell script to trigger member totals recalculation on PRODUCTION
Write-Host "🔄 Recalculating member totals on PRODUCTION..." -ForegroundColor Cyan
Write-Host "This will update all member payment totals from historical payment records." -ForegroundColor Yellow
Write-Host ""

# Production backend URL
$backendUrl = "https://smcf-c99o.onrender.com"

# Get admin credentials
$phone = Read-Host "Enter admin phone number"
$password = Read-Host "Enter admin password" -AsSecureString
$passwordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

try {
    Write-Host "`n📝 Logging in to production..." -ForegroundColor Yellow
    
    # Login to get token
    $loginBody = @{
        phone = $phone
        password = $passwordText
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    if (-not $loginResponse.token) {
        Write-Host "❌ Login failed: No token received" -ForegroundColor Red
        exit 1
    }
    
    $token = $loginResponse.token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    
    # Call recalculate endpoint on production
    Write-Host "`n🔄 Triggering recalculation on PRODUCTION database..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $recalcResponse = Invoke-RestMethod -Uri "$backendUrl/api/members/recalculate-totals" `
        -Method POST `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Updated $($recalcResponse.updatedCount) out of $($recalcResponse.totalMembers) members" -ForegroundColor Cyan
    Write-Host "Message: $($recalcResponse.message)" -ForegroundColor White
    
    if ($recalcResponse.errors -and $recalcResponse.errors.Count -gt 0) {
        Write-Host "`n⚠️  Some errors occurred:" -ForegroundColor Yellow
        $recalcResponse.errors | ForEach-Object {
            Write-Host "  - $($_.member): $($_.error)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✅ All member totals have been recalculated on PRODUCTION!" -ForegroundColor Green
    Write-Host "Refresh https://www.smcf.app to see the updated data." -ForegroundColor Cyan
    
} catch {
    $errorMessage = $_.Exception.Message
    Write-Host "" -ForegroundColor Red
    Write-Host "Error: $errorMessage" -ForegroundColor Red
    if ($_.ErrorDetails) {
        $errorDetails = $_.ErrorDetails.Message
        Write-Host "Details: $errorDetails" -ForegroundColor Red
    }
    exit 1
}
