param(
    [Parameter(Mandatory = $true)][string]$SourceDocx,
    [Parameter(Mandatory = $true)][string]$TargetPdf
)

$ErrorActionPreference = 'Stop'
$word = $null
$document = $null

try {
    $source = [System.IO.Path]::GetFullPath($SourceDocx)
    $target = [System.IO.Path]::GetFullPath($TargetPdf)
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($source, $false, $true)
    $document.ExportAsFixedFormat($target, 17)
    $document.Close($false)
    $document = $null
}
finally {
    if ($document -ne $null) {
        $document.Close($false)
    }
    if ($word -ne $null) {
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
