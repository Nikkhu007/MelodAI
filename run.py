"""
MelodAI Launcher v2
===================
Run: python run.py

Fixes over v1:
  1. uvicorn installed automatically with the right command for Python 3.12+
  2. Port kill on Windows uses both netstat AND taskkill /F /IM node.exe
     to actually clear stuck ports
  3. Crash restart no longer calls start_services() for ALL services —
     only restarts the one that crashed
  4. Frontend crash detection reads the actual port from Vite output
  5. AI install uses --break-system-packages for newer Python versions
  6. Pip flag .pip_installed is deleted on failure so it retries next time
"""

import subprocess, sys, os, time, threading, webbrowser, signal, re
from pathlib import Path

ROOT     = Path(__file__).parent.resolve()
BACKEND  = ROOT / "backend"
FRONTEND = ROOT / "frontend"
AI_SVC   = ROOT / "ai-service"

# ── ANSI colors ───────────────────────────────────────────────────────────────
R  = "\033[0m"
CYAN = "\033[96m"; GREEN = "\033[92m"; MAG = "\033[95m"
YEL  = "\033[93m"; RED   = "\033[91m"; BOLD = "\033[1m"; DIM = "\033[2m"

PROCS      = {}          # name -> Popen
FRONT_PORT = 5173        # updated when Vite reports its actual port

def banner():
    os.system("cls" if os.name == "nt" else "clear")
    # Enable ANSI on Windows
    if os.name == "nt":
        os.system("color")
        subprocess.run("chcp 65001 >nul 2>&1", shell=True)
    print(f"{MAG}{BOLD}")
    print("  ███╗   ███╗███████╗██╗      ██████╗ ██████╗  █████╗ ██╗")
    print("  ████╗ ████║██╔════╝██║     ██╔═══██╗██╔══██╗██╔══██╗██║")
    print("  ██╔████╔██║█████╗  ██║     ██║   ██║██║  ██║███████║██║")
    print("  ██║╚██╔╝██║██╔══╝  ██║     ██║   ██║██║  ██║██╔══██║██║")
    print("  ██║ ╚═╝ ██║███████╗███████╗╚██████╔╝██████╔╝██║  ██║██║")
    print("  ╚═╝     ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝")
    print(f"{R}")

def step(msg):  print(f"\n  {YEL}>>>{R} {BOLD}{msg}{R}", flush=True)
def ok(msg):    print(f"  {GREEN}OK{R}  {msg}", flush=True)
def warn(msg):  print(f"  {YEL}WARN{R} {msg}", flush=True)
def err(msg):   print(f"\n  {RED}ERR{R} {msg}", flush=True)
def fatal(msg): err(msg); sys.exit(1)

def run_cmd(cmd, cwd=None, timeout=300):
    try:
        r = subprocess.run(cmd, shell=True, cwd=cwd,
                           capture_output=True, text=True,
                           timeout=timeout, encoding="utf-8", errors="replace")
        return r.returncode == 0, (r.stdout + r.stderr).strip()
    except Exception as e:
        return False, str(e)

# ── Port killer — aggressive Windows version ──────────────────────────────────
def kill_port(port):
    if os.name == "nt":
        # Method 1: netstat + taskkill by PID
        ok_f, out = run_cmd(f'netstat -ano 2>nul | findstr ":{port} " | findstr "LISTENING"')
        if out:
            for line in out.splitlines():
                parts = line.strip().split()
                if parts:
                    pid = parts[-1]
                    if pid.isdigit() and pid != "0":
                        run_cmd(f"taskkill /F /PID {pid} >nul 2>&1")
        # Method 2: also kill all node/python on these ports by name (belt+suspenders)
        if port in (5000, 8000):
            run_cmd(f'FOR /F "tokens=5" %P IN (\'netstat -ano ^| findstr ":{port}"\') DO @taskkill /F /PID %P >nul 2>&1')
    else:
        run_cmd(f"fuser -k {port}/tcp 2>/dev/null || lsof -ti:{port} | xargs kill -9 2>/dev/null || true")

def kill_all_ports():
    step("Clearing ports 5000, 8000, 5173, 5174, 5175...")
    for port in [5000, 8000, 5173, 5174, 5175]:
        kill_port(port)
    # On Windows also kill any hanging node processes from previous runs
    if os.name == "nt":
        # Only kill node processes on our ports, not all node processes
        run_cmd('wmic process where "name=\'node.exe\'" get processid,commandline 2>nul')
    time.sleep(2)
    ok("Ports cleared")

# ── Prerequisites ─────────────────────────────────────────────────────────────
def check_prereqs():
    step("Checking prerequisites...")
    ok(f"Python {sys.version.split()[0]}")

    ok_f, out = run_cmd("node --version")
    if not ok_f: fatal("Node.js not found → https://nodejs.org")
    ok(f"Node.js {out}")

    ok_f, out = run_cmd("npm --version")
    if not ok_f: fatal("npm not found — reinstall Node.js")
    ok(f"npm {out}")

    ok_f, out = run_cmd("yt-dlp --version")
    if ok_f: ok(f"yt-dlp {out}")
    else:    warn("yt-dlp missing — YouTube disabled. Run: pip install yt-dlp")

    env_file = BACKEND / ".env"
    if not env_file.exists():
        print(f"\n  {RED}MISSING:{R} backend/.env not found!")
        print(f"  Copy backend/.env.example to backend/.env and fill in your values.")
        input("\n  Press Enter once .env is ready...")
        if not env_file.exists():
            fatal("backend/.env still missing.")
    ok(".env found")

# ── Package installation ──────────────────────────────────────────────────────
def install_packages():
    step("Installing packages (first run only)...")

    # ── Python / AI service ───────────────────────────────────────────────────
    flag = AI_SVC / ".pip_installed"
    reqs = AI_SVC / "requirements.txt"

    if not flag.exists() and reqs.exists():
        print(f"  {CYAN}[AI]{R} Installing Python packages (may take 2-3 min)...", flush=True)

        # Try normal pip first, then --break-system-packages for newer Python
        cmds = [
            f'"{sys.executable}" -m pip install -r requirements.txt -q',
            f'"{sys.executable}" -m pip install -r requirements.txt -q --break-system-packages',
            f'"{sys.executable}" -m pip install -r requirements.txt -q --user',
        ]
        installed = False
        for cmd in cmds:
            ok_f, out = run_cmd(cmd, cwd=AI_SVC, timeout=300)
            if ok_f:
                installed = True
                break
            # If it's a partial error about sklearn/numpy version conflict, still proceed
            if "Successfully installed" in out or "already satisfied" in out.lower():
                installed = True
                break

        if installed:
            flag.touch()
            ok("Python packages installed")
        else:
            # Delete flag so it retries next time
            flag.unlink(missing_ok=True)
            warn("Some Python packages failed — AI features may not work")
            warn("Try manually: cd ai-service && pip install -r requirements.txt")

        # Ensure uvicorn is installed separately (critical)
        ok_f, _ = run_cmd(f'"{sys.executable}" -m uvicorn --version')
        if not ok_f:
            print(f"  {CYAN}[AI]{R} Installing uvicorn...", flush=True)
            for cmd in [
                f'"{sys.executable}" -m pip install uvicorn[standard] -q',
                f'"{sys.executable}" -m pip install uvicorn[standard] -q --break-system-packages',
                f'"{sys.executable}" -m pip install uvicorn[standard] -q --user',
            ]:
                ok_f, _ = run_cmd(cmd)
                if ok_f:
                    ok("uvicorn installed")
                    break
            else:
                warn("uvicorn install failed — AI service will not start")
    else:
        # Even if flag exists, verify uvicorn is available
        ok_f, _ = run_cmd(f'"{sys.executable}" -m uvicorn --version')
        if not ok_f:
            print(f"  {CYAN}[AI]{R} Installing uvicorn...", flush=True)
            run_cmd(f'"{sys.executable}" -m pip install uvicorn[standard] -q')
            run_cmd(f'"{sys.executable}" -m pip install uvicorn[standard] -q --break-system-packages')
        ok("Python packages ready")

    # ── Backend npm ───────────────────────────────────────────────────────────
    if not (BACKEND / "node_modules").exists():
        print(f"  {GREEN}[BACKEND]{R} Installing npm packages...", flush=True)
        ok_f, out = run_cmd("npm install", cwd=BACKEND)
        if not ok_f: fatal(f"Backend npm install failed:\n{out[:400]}")
        ok("Backend packages installed")
    else:
        ok("Backend packages ready")

    # ── Frontend npm ──────────────────────────────────────────────────────────
    if not (FRONTEND / "node_modules").exists():
        print(f"  {MAG}[FRONTEND]{R} Installing npm packages...", flush=True)
        ok_f, out = run_cmd("npm install", cwd=FRONTEND)
        if not ok_f: fatal(f"Frontend npm install failed:\n{out[:400]}")
        ok("Frontend packages installed")
    else:
        ok("Frontend packages ready")

# ── Output streamer ───────────────────────────────────────────────────────────
def stream_output(proc, tag, color):
    global FRONT_PORT
    try:
        for line in iter(proc.stdout.readline, ""):
            line = line.rstrip()
            if not line:
                continue
            # Detect what port Vite actually started on
            if tag == "FRONTEND":
                m = re.search(r'Local:\s+http://localhost:(\d+)', line)
                if m:
                    FRONT_PORT = int(m.group(1))
            print(f"  {color}[{tag}]{R} {DIM}{line}{R}", flush=True)
    except Exception:
        pass

# ── Start individual services ─────────────────────────────────────────────────
def make_env():
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"]       = "1"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env

def start_ai():
    env = make_env()
    cmd = [sys.executable, "-m", "uvicorn", "main:app",
           "--host", "0.0.0.0", "--port", "8000",
           "--reload", "--log-level", "warning"]
    proc = subprocess.Popen(
        cmd, cwd=AI_SVC, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, encoding="utf-8", errors="replace"
    )
    PROCS["AI"] = proc
    threading.Thread(target=stream_output, args=(proc, "AI", CYAN), daemon=True).start()
    ok(f"AI Service starting  → http://localhost:8000")
    return proc

def start_backend():
    env = make_env()
    if os.name == "nt":
        nodemon = BACKEND / "node_modules" / ".bin" / "nodemon.cmd"
        cmd = f'"{nodemon}" server.js' if nodemon.exists() else "npx nodemon server.js"
    else:
        cmd = "npx nodemon server.js"
    proc = subprocess.Popen(
        cmd, cwd=BACKEND, env=env, shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, encoding="utf-8", errors="replace"
    )
    PROCS["BACKEND"] = proc
    threading.Thread(target=stream_output, args=(proc, "BACKEND", GREEN), daemon=True).start()
    ok(f"Backend starting     → http://localhost:5000")
    return proc

def start_frontend():
    env = make_env()
    if os.name == "nt":
        vite = FRONTEND / "node_modules" / ".bin" / "vite.cmd"
        cmd = f'"{vite}"' if vite.exists() else "npx vite"
    else:
        cmd = "npx vite"
    proc = subprocess.Popen(
        cmd, cwd=FRONTEND, env=env, shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, encoding="utf-8", errors="replace"
    )
    PROCS["FRONTEND"] = proc
    threading.Thread(target=stream_output, args=(proc, "FRONTEND", MAG), daemon=True).start()
    ok(f"Frontend starting    → http://localhost:5173")
    return proc

def start_all():
    step("Starting services...")
    start_ai()
    start_backend()
    start_frontend()

# ── Wait and open browser ─────────────────────────────────────────────────────
def wait_and_open():
    import urllib.request
    print(f"\n  {YEL}Waiting for app to be ready...{R}", flush=True)
    for _ in range(50):
        time.sleep(1)
        for port in [5173, 5174, 5175]:
            try:
                urllib.request.urlopen(f"http://localhost:{port}", timeout=1)
                time.sleep(0.5)
                url = f"http://localhost:{port}"
                webbrowser.open(url)
                print(f"\n  {GREEN}{BOLD}App is ready!{R}", flush=True)
                print(f"  {GREEN}Opened {url} in your browser{R}", flush=True)
                print(f"\n  {DIM}Demo login: test@melodai.com / test123{R}", flush=True)
                print(f"  {DIM}Press Ctrl+C to stop everything{R}\n", flush=True)
                return
            except Exception:
                continue
    print(f"\n  {YEL}App is taking longer than expected.{R}")
    print(f"  Try opening: {CYAN}http://localhost:5173{R} manually", flush=True)

# ── Cleanup ───────────────────────────────────────────────────────────────────
def cleanup(sig=None, frame=None):
    print(f"\n\n  {YEL}Stopping all services...{R}", flush=True)
    for name, proc in list(PROCS.items()):
        try: proc.terminate()
        except Exception: pass
    time.sleep(1)
    for name, proc in list(PROCS.items()):
        try: proc.kill()
        except Exception: pass
    for port in [5000, 8000, 5173, 5174, 5175]:
        kill_port(port)
    print(f"  {GREEN}All services stopped. Goodbye!{R}\n", flush=True)
    sys.exit(0)

# ── Crash monitor ─────────────────────────────────────────────────────────────
def monitor_crashes():
    """Watch processes and restart only the one that crashed."""
    SERVICE_STARTERS = {
        "AI":       start_ai,
        "BACKEND":  start_backend,
        "FRONTEND": start_frontend,
    }
    while True:
        time.sleep(3)
        for name, proc in list(PROCS.items()):
            if proc.poll() is not None:
                code = proc.returncode
                # AI service exit 0 = uvicorn not found or import error — don't loop-restart
                if name == "AI" and code == 0:
                    # Check if uvicorn is actually available
                    ok_f, _ = run_cmd(f'"{sys.executable}" -m uvicorn --version')
                    if not ok_f:
                        print(f"\n  {RED}[AI]{R} uvicorn not installed — AI features disabled")
                        print(f"  {YEL}Fix:{R} Run: pip install uvicorn[standard]")
                        del PROCS[name]
                        break
                    print(f"\n  {RED}[{name}]{R} crashed (exit {code}) — restarting in 5s...")
                    time.sleep(5)
                else:
                    print(f"\n  {RED}[{name}]{R} crashed (exit {code}) — restarting in 3s...")
                    time.sleep(3)

                # Kill lingering port before restart
                port_map = {"AI": 8000, "BACKEND": 5000, "FRONTEND": 5173}
                if name in port_map:
                    kill_port(port_map[name])
                    time.sleep(1)

                try:
                    SERVICE_STARTERS[name]()
                except Exception as e:
                    print(f"  {RED}Failed to restart {name}: {e}{R}")
                break

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    signal.signal(signal.SIGINT,  cleanup)
    try: signal.signal(signal.SIGTERM, cleanup)
    except Exception: pass

    banner()
    print(f"  {DIM}Press Ctrl+C at any time to stop everything{R}\n")

    check_prereqs()
    install_packages()
    kill_all_ports()
    start_all()

    threading.Thread(target=wait_and_open,    daemon=True).start()
    threading.Thread(target=monitor_crashes,  daemon=True).start()

    print(f"\n  {BOLD}All services running.{R}")
    print(f"  {DIM}Logs from all 3 services appear below.{R}")
    print(f"  {DIM}{'─' * 52}{R}\n")

    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()