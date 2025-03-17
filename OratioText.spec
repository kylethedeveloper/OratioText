# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hiddenimports = ['components', 'utils']
# hiddenimports += collect_submodules('whisper')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[('bin/ffmpeg', '.')],
    datas=collect_data_files('whisper'),
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='OratioText',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['assets/appicon.png'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='OratioText',
)
app = BUNDLE(
    coll,
    name='OratioText.app',
    icon='assets/appicon.png',
    bundle_identifier=None,
)
