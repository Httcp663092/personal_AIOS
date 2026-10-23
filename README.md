# Personal AI OS

面向 Windows 11 x64 的个人本地 AI 桌面助理 MVP。目标设备为荣耀 MagicBook、Ultra 5 225H、32 GB 内存，无独显；Mac M5 可作为显式启用的备用或主推理节点。

**交付状态：代码初版；按用户要求未运行测试。开发环境为 macOS ARM64、没有 Rust，未生成或验证 Windows EXE。GitHub Actions 配置可在 Windows runner 上尝试构建；只有 Actions 成功后才会出现安装包。**

## 已编写功能

- Tauri 2 桌面窗口、系统托盘；关闭窗口隐藏，托盘退出停止后台。
- Python FastAPI sidecar，仅绑定 `127.0.0.1`，每次启动使用随机会话令牌，经 Tauri IPC 代理访问；无外部网页 CORS 授权。
- Ollama 基础多轮聊天、SQLite 本地历史、清空历史。
- 本机模型列表、显式下载 / 删除 Qwen 本地模型。默认 `qwen2.5:7b`，可选择 `qwen2.5:3b` 或安装的 `qwen3` 标签。下载需要联网；不会自动下载模型。
- UTF-8 TXT / Markdown 导入、删除，关键词片段检索与参考文件提示。**不是向量知识库**；暂不支持 PDF / Word / OCR。
- Mac 节点设置、明确的数据发送选项、同名模型主备失败重试。关闭 Mac 选项时只访问本机。
- 开机自启为可选项，默认不主动启用。
- 不包含任何命令、脚本、远程桌面或文件系统执行工具；模型无法授权或调用远程执行。

## 在 Windows 构建

安装以下官方开发依赖，打开新的 PowerShell：

1. [Python 3.11 x64](https://www.python.org/downloads/windows/)（Python Launcher `py` 需可用）。
2. [Node.js 22 LTS](https://nodejs.org/)。
3. [Rust MSVC x64](https://rustup.rs/)；运行 `rustup default stable-x86_64-pc-windows-msvc`。
4. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，勾选「使用 C++ 的桌面开发」和 Windows SDK。
5. [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 通常已有；安装器按 Tauri 默认行为处理缺失依赖）。

```powershell
git clone https://github.com/Httcp663092/personal_AIOS.git
cd personal_AIOS
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows.ps1
```

脚本不运行测试。它将后端打为 PyInstaller 单文件、以 Tauri NSIS 构建当前用户安装器，成功时复制为：

```text
release/PersonalAIOS-Setup.exe
```

安装包**未签名**，不是商用正式发行版；请核对构建来源。运行环境需实机验收。此包不包含 Ollama 或模型权重；首次使用需另行安装。构建需要网络获取依赖，首次模型下载也需要网络；已下载模型的推理无需云端。

### GitHub 自动构建

打开仓库 **Actions → Build Windows installer (no tests) → Run workflow**，或推送匹配路径的代码到 main。成功后在该次运行的 Artifacts 下载 `PersonalAIOS-Windows-x64-unsigned`，解压取得 EXE。失败时查看对应步骤日志；没有 artifact 代表尚未得到安装包。此流程不会发布 GitHub Release，也不会上传聊天或本机数据库。

## 首次使用

1. 在 Windows 安装 [Ollama](https://ollama.com/download/windows)，保持其后台运行。
2. 建议在 Windows 用户环境变量设置 `OLLAMA_NO_CLOUD=1`，完全退出再重启 Ollama；Mac 节点也应设置该变量。参见 [Ollama FAQ](https://docs.ollama.com/faq)。
3. 安装并打开 Personal AI OS。在「模型与节点」点击下载 `qwen2.5:7b`；也可自行运行 `ollama pull qwen2.5:7b`。
4. 在「偏好设置」使用与 Ollama 列表**完全一致**的模型标签，返回对话。
5. 不要把 Ollama 暴露到公网。应用限定回环 / 私有 IPv4 地址、拒绝重定向，不配置公网 API；聊天前要求模型已安装且无 Ollama 远程模型元数据。

没有针对 Ultra 5 的速度实测，本版本走 Ollama 已支持的执行路径，**不承诺 Intel NPU 加速**。先以 7B 或 3B 模型确认响应速度；应用上下文上限设置为 4096，生成上限 1024 tokens。

## Mac M5 节点（推荐 SSH 隧道）

Mac 自行启用「系统设置 → 通用 → 共享 → 远程登录」，仅允许你的账户；这一步涉及系统访问权限，请自行完成。Mac 的 Ollama 保持默认 localhost，安装与 Windows 相同的模型。

在 Windows 终端中运行（替换账号和 Mac 的局域网地址）：

```powershell
ssh -N -L 127.0.0.1:11435:127.0.0.1:11434 your-mac-user@192.168.1.20
```

自行确认服务器指纹并完成认证。隧道窗口保持打开；本应用不会保存 SSH 密码或执行 SSH 命令。

在应用「偏好设置」勾选允许发送到 Mac，地址填 `http://127.0.0.1:11435`，选择主节点及是否自动切换。节点离线、模型不存在、推理失败或超时（单节点最多约 180 秒）时才尝试备用；不提供后台持续监测、负载均衡或无缝续传。失败重试可能让原节点继续短暂计算。

也接受显式配置的私有 IPv4 HTTP Ollama 地址，但不带应用级传输加密；推荐隧道。启用 Mac 时，近期聊天及选中的知识片段会发送到该节点。

## 本地数据与边界

- Windows 数据：`%LOCALAPPDATA%\PersonalAIOS\memory.sqlite3`。保存聊天、导入内容、节点设置；没有云端同步。
- SQLite 未加密。请使用自己的 Windows 账户及设备磁盘加密；卸载程序保留数据，删除前自行备份。
- 聊天界面显示最近 100 条；推理带最近 12 条。导入最多 100 份，单文件最多 2 MB，检索选取最多 4 个片段。
- “来源”表示提供给模型的片段来源，不保证模型回答与来源一致。
- 本地令牌防止任意网页直接调用后台，不抵御同账户恶意软件或管理员。
- 用户设置和模型输出不作为命令执行。导入文件作为不可信上下文处理，但不能保证模型完全抵御提示注入。
- 正常退出会结束后台；关闭窗口保留托盘。异常退出保护依靠父进程监测，仍需 Windows 实机确认。
- 当前不做多进程单实例控制；不要同时打开多个实例。
- 不包含自动安装 Ollama、开机启动 Ollama、自动管理隧道、流式输出或模型下载进度百分比。

## 开发结构

```text
backend/main.py                 API / 记忆 / 检索 / Ollama 路由
frontend/                       无构建前端，使用 Tauri IPC
src-tauri/                      桌面托盘、后台生命周期、自启
scripts/build-windows.ps1       Windows 原生打包
.github/workflows/windows-build.yml  Windows CI 构建（无测试）
```

后端开发时先安装 `backend/requirements.txt`，设定高强度随机 `PERSONALAI_TOKEN` 后运行 `python backend/main.py --port 18765`，请求需附 `Authorization: Bearer <token>`。前端不能直接用普通浏览器连接，它依赖 Tauri IPC。

## 后续实机验收（本次未执行）

- 全新 Windows 用户安装、首次打开、未安装 Ollama 时的提示。
- 下载模型、离线聊天、重启后历史、清空记录。
- 中英文 TXT / Markdown 导入、来源提示、删除。
- Mac 隧道主备切换、关闭远程选项后的请求行为。
- 托盘退出、异常关闭、开机自启开关及卸载。
- 未授权请求、端口冲突、损坏数据库、超时与模型下载中断。

参考接口：[Tauri Sidecar](https://v2.tauri.app/develop/sidecar/)、[Tauri Autostart](https://v2.tauri.app/plugin/autostart/)、[Ollama API](https://docs.ollama.com/api)。
