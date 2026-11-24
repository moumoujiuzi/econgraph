using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("EconGraph")]
[assembly: AssemblyDescription("EconGraph 经济学函数绘图台")]
[assembly: AssemblyProduct("EconGraph")]
[assembly: AssemblyCompany("EconGraph")]
[assembly: AssemblyCopyright("MIT License")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace EconGraph
{
    /// <summary>
    /// 极简启动器：转发命令行参数，并以 --no-sandbox 拉起 Electron 内核。
    /// 之所以需要它：部分 Windows 环境下 Chromium 沙箱无法初始化，
    /// 不带该开关会直接崩溃；参数必须在进程启动时就传入。
    /// </summary>
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] argv)
        {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            string target = Path.Combine(dir, "EconGraph-bin.exe");

            if (!File.Exists(target))
            {
                MessageBox.Show(
                    "找不到程序主体 EconGraph-bin.exe。\r\n请确认整个 EconGraph 文件夹完整，不要单独移动 exe。",
                    "EconGraph 启动失败",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            var sb = new System.Text.StringBuilder();
            sb.Append("--no-sandbox");
            foreach (string a in argv)
            {
                sb.Append(' ');
                sb.Append('"').Append(a.Replace("\"", "\\\"")).Append('"');
            }

            var psi = new ProcessStartInfo(target)
            {
                Arguments = sb.ToString(),
                WorkingDirectory = dir,
                UseShellExecute = false
            };

            // 防止外部环境把它当成纯 Node 进程启动
            try { psi.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE"); } catch { }

            try
            {
                Process.Start(psi);
                return 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show("无法启动 EconGraph：\r\n" + ex.Message,
                    "EconGraph 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 2;
            }
        }
    }
}
