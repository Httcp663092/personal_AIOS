#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::Mutex;
use tauri::{Manager, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_shell::{ShellExt, process::CommandChild};
struct Backend { port: u16, token: String, child: Mutex<Option<CommandChild>> }
#[tauri::command]
async fn api(state: tauri::State<'_, Backend>, method: String, path: String, body: Option<serde_json::Value>) -> Result<serde_json::Value,String> {
    let valid = matches!(path.as_str(), "/health"|"/settings"|"/status"|"/messages"|"/chat"|"/documents"|"/models"|"/models/pull") || path.strip_prefix("/documents/").map(|s| !s.is_empty() && s.chars().all(|c|c.is_ascii_digit())).unwrap_or(false);
    if !valid { return Err("不允许的接口".into()) }
    let m = match method.as_str() { "GET" => reqwest::Method::GET, "POST" => reqwest::Method::POST, "PUT" => reqwest::Method::PUT, "DELETE" => reqwest::Method::DELETE, _ => return Err("不允许的方法".into()) };
    let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(1900)).build().map_err(|e|e.to_string())?;
    let mut r = client.request(m, format!("http://127.0.0.1:{}{}",state.port,path)).bearer_auth(&state.token);
    if let Some(value) = body { r = r.json(&value) }
    let response = r.send().await.map_err(|_| "后端尚未启动或已停止，请稍后重试".to_string())?;
    let status = response.status();
    let data: serde_json::Value = response.json().await.map_err(|e|e.to_string())?;
    if !status.is_success() { return Err(data.get("detail").map(|v|v.to_string()).unwrap_or_else(|| status.to_string())) }
    Ok(data)
}
fn main() {
    let app = tauri::Builder::default()
      .plugin(tauri_plugin_shell::init())
      .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent,None))
      .invoke_handler(tauri::generate_handler![api])
      .setup(|app| {
        let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        drop(listener);
        let token = uuid::Uuid::new_v4().to_string();
        let (mut rx, child) = app.shell().sidecar("personalai-backend")?.args(["--port", &port.to_string()]).env("PERSONALAI_TOKEN",&token).env("PERSONALAI_PARENT_PID",std::process::id().to_string()).spawn()?;
        tauri::async_runtime::spawn(async move { while rx.recv().await.is_some() {} });
        app.manage(Backend {port,token,child:Mutex::new(Some(child))});
        let show = MenuItem::with_id(app,"show","打开 Personal AI OS",true,None::<&str>)?;
        let quit = MenuItem::with_id(app,"quit","退出并停止后台",true,None::<&str>)?;
        let menu = Menu::with_items(app,&[&show,&quit])?;
        let icon = tauri::image::Image::new_owned([57,112,238,255].repeat(32*32),32,32);
        TrayIconBuilder::new().icon(icon).tooltip("Personal AI OS").menu(&menu).on_menu_event(|app,event| {
            match event.id.as_ref() { "show" => {if let Some(w)=app.get_webview_window("main") {let _=w.show();let _=w.set_focus();}}, "quit"=>app.exit(0), _=>() }
        }).build(app)?;
        Ok(())
      }).on_window_event(|window,event| {
          if let tauri::WindowEvent::CloseRequested{api,..}=event {api.prevent_close();let _=window.hide();}
      }).build(tauri::generate_context!()).expect("无法启动 Personal AI OS");
    app.run(|app,event| { if let tauri::RunEvent::Exit = event { if let Some(state)=app.try_state::<Backend>() { if let Some(child)=state.child.lock().unwrap().take() {let _=child.kill();} } } });
}
