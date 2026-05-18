import os, re

bundle_file = "cri-dashboard-codigo-completo.txt"

with open(bundle_file, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

pattern = r"^===\s+(\./.+?)\s+===\s*$"
lines = content.splitlines(True)

current = None
buf = []

def flush():
    global current, buf
    if not current:
        return
    p = current.replace("./", "").replace("\\", "/").strip()
    folder = os.path.dirname(p)
    if folder:
        os.makedirs(folder, exist_ok=True)
    with open(p, "w", encoding="utf-8", errors="ignore") as out:
        out.writelines(buf)

for line in lines:
    m = re.match(pattern, line.strip())
    if m:
        flush()
        current = m.group(1)
        buf = []
    else:
        if current:
            buf.append(line)

flush()
print("✅ Projeto extraído com sucesso!")