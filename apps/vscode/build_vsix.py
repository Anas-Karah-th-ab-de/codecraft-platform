"""VSIX (ZIP) der VS-Code-Erweiterung bauen – ohne vsce/npm.

Aufruf: python3 apps/vscode/build_vsix.py  ->  apps/web/public/downloads/km-portal.vsix
"""
import json
import pathlib
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "downloads" / "km-portal.vsix"
pkg = json.loads((HERE / "package.json").read_text())

README = """# KM Code Craft Portal

Anrufe, Mitteilungen und Chat-Nachrichten aus dem Portal direkt in VS Code.

1. Im Portal unter **Konto -> Angemeldete Geräte & Schlüssel** einen Schlüssel erstellen.
2. In VS Code den Befehl **KM Portal: Anmelden** ausführen, Adresse und Schlüssel einfügen.
3. Eingehende Anrufe erscheinen als Meldung – **Annehmen** öffnet das Portal im Browser.
"""

TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension=".json" ContentType="application/json"/>
<Default Extension=".js" ContentType="application/javascript"/>
<Default Extension=".md" ContentType="text/markdown"/>
<Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>"""

MANIFEST = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}" />
    <DisplayName>{pkg['displayName']}</DisplayName>
    <Description xml:space="preserve">{pkg['description']}</Description>
    <Tags></Tags>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{pkg['engines']['vscode']}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>"""

OUT.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", TYPES)
    z.writestr("extension.vsixmanifest", MANIFEST)
    z.writestr("extension/package.json", (HERE / "package.json").read_text())
    z.writestr("extension/extension.js", (HERE / "extension.js").read_text())
    z.writestr("extension/README.md", README)
print(OUT, OUT.stat().st_size)
