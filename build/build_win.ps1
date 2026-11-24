# ============================================================================
# 组装 EconGraph 便携版：Electron 内核 + 应用代码 + 原生启动器 + 图标
# 产物：dist\EconGraph-win32-x64\EconGraph.exe
# ============================================================================
$ErrorActionPreference = 'Stop'

$root     = 'J:\workplace\code\econ-graph-build'
$src      = 'J:\workplace\code\econ-graph'
$elec     = Join-Path $root 'electron-28.3.3'
$outDir   = Join-Path $root 'dist\EconGraph-win32-x64'
$icon     = Join-Path $root 'icon.ico'
$iconPng  = Join-Path $root 'icon.png'
$csc      = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$rcedit   = Join-Path $root 'rcedit.exe'
$launcher = Join-Path $root 'launcher\Program.cs'

Write-Host '--- 1/7 清理输出目录 ---'
Get-Process EconGraph* -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host '--- 2/7 复制 Electron 运行时 ---'
robocopy $elec $outDir /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }

Write-Host '--- 3/7 放入应用代码 ---'
$appDir = Join-Path $outDir 'resources\app'
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item (Join-Path $src 'index.html')   $appDir
Copy-Item (Join-Path $src 'styles.css')   $appDir
Copy-Item (Join-Path $src 'package.json') $appDir
Copy-Item (Join-Path $src 'js')           $appDir -Recurse
Copy-Item (Join-Path $src 'desktop')      $appDir -Recurse
Copy-Item (Join-Path $src 'README.md')    $appDir -ErrorAction SilentlyContinue
$assets = Join-Path $appDir 'assets'
New-Item -ItemType Directory -Force -Path $assets | Out-Null
if (Test-Path $iconPng) { Copy-Item $iconPng (Join-Path $assets 'icon.png') }
$branding = Join-Path $root 'branding'
if (Test-Path $branding) { Copy-Item (Join-Path $branding '*') $assets -Force }

Write-Host '--- 4/7 重命名内核 + 精简语言包 ---'
Rename-Item (Join-Path $outDir 'electron.exe') 'EconGraph-bin.exe'
$locales = Join-Path $outDir 'locales'
if (Test-Path $locales) {
  Get-ChildItem $locales -File | Where-Object { $_.Name -notin @('zh-CN.pak', 'en-US.pak') } | Remove-Item -Force
}
Remove-Item (Join-Path $outDir 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue


Write-Host '--- 5/7 编译原生启动器 ---'
& $csc /nologo /target:winexe /platform:anycpu /optimize+ `
    "/out:$outDir\EconGraph.exe" `
    "/win32icon:$icon" `
    /r:System.Windows.Forms.dll `
    $launcher
if ($LASTEXITCODE -ne 0) { throw "csc failed: $LASTEXITCODE" }
$icoFile = Join-Path $branding 'mascot.ico'
if ((Test-Path $rcedit) -and (Test-Path $icoFile)) { 
  & $rcedit (Join-Path $outDir 'EconGraph.exe') --set-icon $icoFile | Out-Null
  Write-Host '    exe icon applied'
}

Write-Host '--- 6/7 生成使用说明 ---'
$readme = @'
EconGraph · 经济学函数绘图台（便携版 v2）

【打开】
  双击 EconGraph.exe。整个文件夹可整体拷走，不要只拷 exe。

【曲线类型】
  y=f(x)      直接写表达式，如 0.8*Y + 200
  F(x,y)=0    隐函数，如 x - (100 + 0.75*(x-100) + 200 - 25*y + G)
  参数方程    分别写 x(t) 与 y(t)
  极坐标      r = 1 + cos(theta)

【命令行】
  EconGraph.exe --preset=islm
  EconGraph.exe --preset=demand-supply --param A=75 --param B0=20
  EconGraph.exe --preset=free --expr="a*x^2 + b*x + 1" --param a=0.6 --view=-5,5,-6,12
  EconGraph.exe --export=out.png --preset=solow --width=1600 --height=1000
  EconGraph.exe --tikz=fig.tex --preset=bond
  EconGraph.exe --list

  模板：consumption / demand-supply / price-ceiling / indifference / cost /
        islm / adas / solow / isoquant / cournot / lorenz / free /
        option-payoff / sml / bond /
        weierstrass / polynomial-high / derivatives / taylor / fourier
        lotka / sir / saddle / spiral / islm-dyn（动态系统）

【默认界面】
  启动即「自定义函数」画布（示例 y = x^2）；经济学/金融/数学/动态模板在下拉框里选。

【实时绘制】
  顶栏输入不用回车，边打边画，并自动切到「自定义函数」画布；
  打到一半会保留上一段完整表达式。

【视图】
  缩放滑杆 10%–400%（拖白点），复位回 100%；「坐标轴贴边」默认勾选，
  坐标轴自适应（0 在范围内就过原点），可勾选强制贴边；画布随窗口自适应。

【中文输入】
  五分之三 / x的十次方 / 根号x加三 / x²+π / ∞ 都能直接输入，自动转成标准写法；
  回车后顶栏里的中文会被改写成标准式（如 e的x分之一次方 → exp((1)/(x))）。

【顶部命令栏】
  直接输入并回车：sin(x) / 2+3*4 / x^2+y^2=4 / taylor(sin(x),7) /
  series(通项,N) / nested(sqrt(2+R),10) / deriv(f,k) / preset(id) / clear

【工坊面板】
  可拖动（按住标题栏），背景不虚化，曲线始终可见，可边调边看。

【面板】
  ∑ 级数工坊：泰勒逐项、级数逐项（含 N 输入）、导数逐阶、嵌套根式——点一下长一项/一层
  ∂ 数值工具：求根/交点、切线、定积分、黎曼和、迭代蛛网、数据拟合（OLS）
  ƒ 数学工具：高阶导数、泰勒展开、二项式定理、莱布尼茨公式

【输出】
  导出 PNG（图表本体）
  导出 TikZ（可直接粘进 LaTeX）
  存为对照（改参数后新旧曲线对比）

【快捷键】
  滚轮缩放、拖拽平移、Esc 关闭面板
'@
Set-Content -Path (Join-Path $outDir '使用说明.txt') -Value $readme -Encoding UTF8

Write-Host '--- 7/7 统计 ---'
$exe = Join-Path $outDir 'EconGraph.exe'
$files = Get-ChildItem $outDir -Recurse -File
$sizeMB = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host ("    启动器: {0:N0} KB" -f ((Get-Item $exe).Length / 1KB))
Write-Host ("    文件数: {0}   总计: {1} MB" -f $files.Count, $sizeMB)







