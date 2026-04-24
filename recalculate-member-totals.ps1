# PowerShell script to recalculate member totals
Write-Host "🔄 Recalculating member totals from payment records..." -ForegroundColor Cyan

# Get admin credentials
$email = Read-Host "Enter admin email"
$password = Read-Host "Enter admin password" -AsSecureString
$passwordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Backend URL
$backendUrl = "http://localhost:4000"

try {
    Write-Host "`n📝 Logging in as admin..." -ForegroundColor Yellow
    
    # Login to get token
    $loginBody = @{
        email = $email
        password = $passwordText
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody
    
    if (-not $loginResponse.token) {
        Write-Host "❌ Login failed: No token received" -ForegroundColor Red
        exit 1
    }
    
    $token = $loginResponse.token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    
    # Call recalculate endpoint
    Write-Host "`n🔄 Triggering recalculation..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $recalcResponse = Invoke-RestMethod -Uri "$backendUrl/api/members/recalculate-totals" `
        -Method POST `
        -Headers $headers
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Updated $($recalcResponse.updatedCount) out of $($recalcResponse.totalMembers) members" -ForegroundColor Cyan
    Write-Host "Message: $($recalcResponse.message)" -ForegroundColor White
    
    if ($recalcResponse.errors) {
        Write-Host "`n⚠️  Some errors occurred:" -ForegroundColor Yellow
        $recalcResponse.errors | ForEach-Object {
            Write-Host "  - $($_.member): $($_.error)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✅ Member totals have been recalculated. Refresh your browser to see the updated data." -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails)" -ForegroundColor Red
    }
    exit 1
}
