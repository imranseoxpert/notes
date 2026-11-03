; Windows installer: build/Notes-Setup-x64.exe, made by build.sh when NSIS (makensis) is installed.
; Installs for the current user only (no admin prompt) into %LOCALAPPDATA%\Programs\Notes, with Start Menu and
; desktop shortcuts and an uninstaller in Settings → Apps. Notes keeps its data in %APPDATA%\Notes, so
; installing a new version over an old one keeps everything.
Unicode true
!include "MUI2.nsh"
!ifndef VERSION
  !define VERSION "1.0.0"
!endif

Name "Notes"
OutFile "build/Notes-Setup-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\Notes"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Notes"
VIAddVersionKey "FileDescription" "Notes installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "MIT License"

!define MUI_ICON "build/Notes/resources/app/notes.ico"
!define MUI_UNICON "build/Notes/resources/app/notes.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Notes.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open Notes"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

!define UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\Notes"

Section
  nsExec::Exec 'taskkill /IM Notes.exe /F'           ; a copy running in the tray would lock its files
  Sleep 500
  SetOutPath "$INSTDIR"
  File /r "build/Notes/*"
  WriteUninstaller "$INSTDIR\Uninstall Notes.exe"
  CreateShortcut "$SMPROGRAMS\Notes.lnk" "$INSTDIR\Notes.exe" "" "$INSTDIR\resources\app\notes.ico"
  CreateShortcut "$DESKTOP\Notes.lnk" "$INSTDIR\Notes.exe" "" "$INSTDIR\resources\app\notes.ico"
  WriteRegStr HKCU "${UNINST}" "DisplayName" "Notes"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "Publisher" "imranseoxpert"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "$INSTDIR\resources\app\notes.ico"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"$INSTDIR\Uninstall Notes.exe"'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM Notes.exe /F'
  Sleep 500
  Delete "$SMPROGRAMS\Notes.lnk"
  Delete "$DESKTOP\Notes.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST}"
SectionEnd
