# Recalculate member totals on production
Write-Host "Recalculating member totals on PRODUCTION..." -ForegroundColor Cyan

$backendUrl = "https://smcf-c99o.onrender.com"

$phone = Read-Host "Enter admin phone number"
$password = Read-Host "Enter admin password" -AsSecureString
$passwordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

try {
    Write-Host "Logging in to production..." -ForegroundColor Yellow
    
    $loginBody = @{
        phone = $phone
        password = $passwordText
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -ErrorAction Stop
    
    if (-not $loginResponse.token) {
        Write-Host "Login failed" -ForegroundColor Red
        exit 1
    }
    
    $token = $loginResponse.token
    Write-Host "Login successful!" -ForegroundColor Green
    
    Write-Host "Triggering recalculation..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $recalcResponse = Invoke-RestMethod -Uri "$backendUrl/api/members/recalculate-totals" -Method POST -Headers $headers -ErrorAction Stop
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Updated $($recalcResponse.updatedCount) out of $($recalcResponse.totalMembers) members" -ForegroundColor Cyan
    Write-Host $recalcResponse.message -ForegroundColor White
    
    Write-Host "Done! Refresh https://www.smcf.app to see updated data." -ForegroundColor Green
    
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
