#!/bin/bash
# Läuft als root auf dem Produktionsserver: Android-Build-Umgebung (Benutzer "builder") einrichten,
# Release-Schlüssel einmalig erzeugen, KM-Portal-APK bauen und unter /downloads/km-portal.apk ablegen.
set -euo pipefail
log() { echo "[$(date '+%F %T')] $*"; }
B=/home/builder
id builder >/dev/null 2>&1 || useradd -m -s /bin/bash builder

log "Pakete"
DEBIAN_FRONTEND=noninteractive apt-get install -y -q openjdk-21-jdk-headless unzip build-essential pkg-config libssl-dev python3 >/dev/null

as() { sudo -u builder -H bash -lc "$*"; }

if [ ! -x $B/android/cmdline-tools/latest/bin/sdkmanager ]; then
  log "Android cmdline-tools"
  Z=$(curl -s https://dl.google.com/android/repository/repository2-3.xml | grep -oE 'commandlinetools-linux-[0-9]+_latest\.zip' | sort -V | tail -1)
  as "mkdir -p ~/android/cmdline-tools && cd /tmp && curl -sSLo ct.zip https://dl.google.com/android/repository/$Z && unzip -qo ct.zip -d ~/android/cmdline-tools && rm -rf ~/android/cmdline-tools/latest && mv ~/android/cmdline-tools/cmdline-tools ~/android/cmdline-tools/latest && rm ct.zip"
fi
cat > $B/.android-env <<'EOF'
export ANDROID_HOME=$HOME/android
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$HOME/.cargo/bin:$PATH
export NDK_HOME=$(ls -d $ANDROID_HOME/ndk/* 2>/dev/null | sort -V | tail -1)
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
EOF
chown builder: $B/.android-env
grep -q android-env $B/.profile || echo '. ~/.android-env' >> $B/.profile

log "SDK-Pakete"
as 'yes | sdkmanager --licenses >/dev/null 2>&1 || true
L=$(sdkmanager --list 2>/dev/null | awk "/^  (build-tools|ndk|platforms)[\/;]/{print \$1}" | tr "/" ";" | grep -vE "rc|alpha|beta|ext")
BT=$(echo "$L" | grep -E "^build-tools;3[5-9]" | sort -V | tail -1)
NDK=$(echo "$L" | grep -E "^ndk;2[7-9]" | sort -V | tail -1)
PF=$(echo "$L" | grep -E "^platforms;android-37" | sort -V | head -1)
echo "nehme $BT $NDK $PF"
sdkmanager --install "platform-tools" "$PF" "$BT" "$NDK" 2>&1 | tail -3
ls ~/android ~/android/platforms ~/android/ndk'

log "Rust"
as 'command -v rustup >/dev/null || (curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal >/dev/null)
rustup target add aarch64-linux-android armv7-linux-androideabi >/dev/null
command -v cargo-tauri >/dev/null || cargo install tauri-cli --version "^2" --locked -q'

log "Release-Schlüssel"
as 'mkdir -p ~/keys && chmod 700 ~/keys
if [ ! -f ~/keys/km-portal.jks ]; then
  P=$(openssl rand -hex 20)
  keytool -genkeypair -v -keystore ~/keys/km-portal.jks -alias km-portal -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$P" -keypass "$P" -dname "CN=KM Code Craft, O=KM Code Craft, C=DE" >/dev/null 2>&1
  printf "storeFile=%s\nstorePassword=%s\nkeyAlias=km-portal\nkeyPassword=%s\n" ~/keys/km-portal.jks "$P" "$P" > ~/keys/keystore.properties
  chmod 600 ~/keys/*
fi'

log "App-Icons (Android-Mipmaps aus icons/icon.png)"
as 'cd ~/codecraft-platform/apps/app/src-tauri && cargo tauri icon icons/icon.png >/dev/null 2>&1 || echo "Icon-Erzeugung fehlgeschlagen"'

# Zwei Varianten: Play Protect blockiert Sideload-Apps mit Bedienungshilfe (BIND_ACCESSIBILITY_SERVICE).
#  km-portal.apk               – Standard ohne Fernsteuerung (Support sieht nur zu), für alle
#  km-portal-fernsteuerung.apk – mit Bedienungshilfe (tippen/wischen), gleiche App-ID, ersetzt die Standard-App
build() {
  as 'cd ~/codecraft-platform/apps/app/src-tauri
cp ~/keys/keystore.properties gen/android/keystore.properties
nice -n 10 cargo tauri android build --apk --target aarch64 --target armv7 2>&1 | grep -vE "^\s+(Compiling|Downloaded|Downloading)" | grep -E "error|Error|FAIL|Finished|BUILD|went wrong" | tail -15' >&2
  ls -t $B/codecraft-platform/apps/app/src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk | head -1
}
G=$B/codecraft-platform/apps/app/src-tauri/gen/android
# lokal erzeugte Tauri-Dateien enthalten Pfade des Entwickler-PCs → neu erzeugen lassen
rm -rf $G/tauri.settings.gradle $G/.tauri $G/app/tauri.build.gradle.kts $G/.gradle
M=$G/app/src/main/AndroidManifest.xml
cp $M /tmp/AndroidManifest.full.xml
mkdir -p /var/www/downloads

log "APK mit Fernsteuerung bauen"
A=$(build); install -m 644 "$A" /var/www/downloads/km-portal-fernsteuerung.apk

log "Standard-APK ohne Bedienungshilfe bauen"
python3 - "$M" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
s2 = re.sub(r'\s*<service android:name="\.ControlService".*?</service>', '', s, flags=re.S)
assert s2 != s, "ControlService nicht gefunden"
open(p, "w").write(s2)
PY
A=$(build); install -m 644 "$A" /var/www/downloads/km-portal.apk
cp /tmp/AndroidManifest.full.xml $M; chown builder: $M

BT=$(ls -d $B/android/build-tools/* | sort -V | tail -1)
for f in km-portal.apk km-portal-fernsteuerung.apk; do
  n=$(unzip -p /var/www/downloads/$f AndroidManifest.xml | strings | grep -c ControlService || true)
  echo "$f: $(stat -c %s /var/www/downloads/$f) Bytes, ControlService-Einträge: $n"
  JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 $BT/apksigner verify /var/www/downloads/$f && echo "  Signatur ok"
done
log "fertig"
