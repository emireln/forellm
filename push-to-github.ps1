# Push ForeLLM to https://github.com/emireln/forellm
# Run from project root in PowerShell: .\push-to-github.ps1

Set-Location $PSScriptRoot

if (-not (Test-Path .git)) {
    git init
    git add .
    git commit -m "Initial commit: ForeLLM by Emir Lima"
    git branch -M main
    git remote add origin https://github.com/emireln/forellm.git
    git push -u origin main
} else {
    git add .
    git status
    Write-Host ""
    Write-Host "Repo already initialized. To push:"
    Write-Host "  git remote add origin https://github.com/emireln/forellm.git   # only if not already added"
    Write-Host "  git commit -m 'Your message'   # if you have changes"
    Write-Host "  git push -u origin main"
}
