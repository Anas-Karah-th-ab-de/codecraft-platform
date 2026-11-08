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

log "APK bauen"
as 'cd ~/codecraft-platform/apps/app/src-tauri
cp ~/keys/keystore.properties gen/android/keystore.properties
nice -n 10 cargo tauri android build --apk --target aarch64 --target armv7 2>&1 | grep -vE "^\s+(Compiling|Downloaded|Downloading)" | tail -40'

APK=$(ls -t $B/codecraft-platform/apps/app/src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk | head -1)
log "fertig: $APK"
ls -lh "$APK"
