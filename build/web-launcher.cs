using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

namespace EconGraphWeb
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                string root = PreparePayload();
                if (root == null) return 2;

                string index = Path.Combine(root, "index.html");
                string browser = FindBrowser();
                if (browser == null)
                {
                    Fail("没有找到 Microsoft Edge 或 Google Chrome。\n本版本需要系统自带 Edge（Windows 10/11 默认就有）。");
                    return 4;
                }

                string profile = Path.Combine(root, "profile");
                string url = "file:///" + index.Replace("\\", "/");
                string query = BuildQuery(args);
                if (query.Length > 0) url += "?" + query;

                var psi = new ProcessStartInfo(browser);
                psi.Arguments =
                    "--app=\"" + url + "\" " +
                    "--window-size=1500,940 " +
                    "--user-data-dir=\"" + profile + "\" " +
                    "--no-first-run --no-default-browser-check --disable-gpu " +
                    "--disable-features=Translate,msEdgeTranslate --disable-sync";
                psi.UseShellExecute = false;
                Process.Start(psi);
                return 0;
            }
            catch (Exception ex)
            {
                Fail("启动失败：" + ex.Message);
                return 5;
            }
        }

        private static string BuildQuery(string[] args)
        {
            if (args == null || args.Length == 0) return "";
            var sb = new StringBuilder();
            foreach (var a in args)
            {
                string s = a.TrimStart('-');
                string k, v;
                int eq = s.IndexOf('=');
                if (eq > 0) { k = s.Substring(0, eq); v = s.Substring(eq + 1); }
                else { k = s; v = "1"; }
                if (k.Length == 0) continue;
                if (k == "export") v = "1";
                if (sb.Length > 0) sb.Append('&');
                sb.Append(Uri.EscapeDataString(k)).Append('=').Append(Uri.EscapeDataString(v));
            }
            return sb.ToString();
        }

        private static byte[] Payload()
        {
            var asm = Assembly.GetExecutingAssembly();
            using (var raw = asm.GetManifestResourceStream("AppZip"))
            {
                if (raw == null) return null;
                using (var ms = new MemoryStream()) { raw.CopyTo(ms); return ms.ToArray(); }
            }
        }

        private static string ExeDir
        {
            get { return Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName); }
        }

        private static IEnumerable<string> Roots(long stamp)
        {
            string tag = "v-" + stamp.ToString("x");
            yield return Path.Combine(ExeDir, "EconGraphWeb-data", tag);
            yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EconGraphWeb", tag);
            yield return Path.Combine(Path.GetTempPath(), "EconGraphWeb", tag);
        }

        private static string PreparePayload()
        {
            byte[] data = Payload();
            if (data == null) { Fail("内嵌资源缺失"); return null; }

            string lastErr = null;
            foreach (var root in Roots(data.Length))
            {
                string index = Path.Combine(root, "index.html");
                if (File.Exists(index)) return root;
                try
                {
                    Directory.CreateDirectory(root);
                    using (var ms = new MemoryStream(data))
                    using (var zip = new ZipArchive(ms, ZipArchiveMode.Read))
                    {
                        foreach (var entry in zip.Entries)
                        {
                            if (string.IsNullOrEmpty(entry.Name)) continue;
                            string target = Path.Combine(root, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                            Directory.CreateDirectory(Path.GetDirectoryName(target));
                            entry.ExtractToFile(target, true);
                        }
                    }
                    if (File.Exists(index)) return root;
                    lastErr = "解压后缺少 index.html：" + root;
                }
                catch (Exception ex) { lastErr = ex.Message; }
            }

            Fail("解压失败：" + (lastErr ?? "未知错误"));
            return null;
        }

        private static string FindBrowser()
        {
            string[] exeNames = { "msedge.exe", "chrome.exe" };
            string[] roots = {
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
            };
            string[] rels = { @"Microsoft\Edge\Application\", @"Google\Chrome\Application\" };

            foreach (var exe in exeNames)
            {
                try
                {
                    using (var k = Registry.LocalMachine.OpenSubKey(
                        @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                    {
                        if (k != null)
                        {
                            var p = k.GetValue(null) as string;
                            if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;
                        }
                    }
                }
                catch { }

                foreach (var r in roots)
                {
                    if (string.IsNullOrEmpty(r)) continue;
                    foreach (var rel in rels)
                    {
                        try
                        {
                            string p = Path.Combine(r, rel + exe);
                            if (File.Exists(p)) return p;
                        }
                        catch { }
                    }
                }
            }
            return null;
        }

        private static void Fail(string msg)
        {
            MessageBox.Show(msg, "EconGraph", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}

