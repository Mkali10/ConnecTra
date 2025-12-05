!include LogicLib.nsh

Name "ConnecTra"
OutFile "ConnecTra-Setup.exe"
InstallDir "$PROGRAMFILES\ConnecTra"
InstallDirRegKey HKCU "Software\ConnecTra" ""

Page directory
Page instfiles

Section "ConnecTra"
  SetOutPath $INSTDIR
  File /r "dist\*.*"
  
  CreateDirectory "$SMPROGRAMS\ConnecTra"
  CreateShortCut "$SMPROGRAMS\ConnecTra\ConnecTra.lnk" "$INSTDIR\ConnecTra.exe"
  CreateShortCut "$DESKTOP\ConnecTra.lnk" "$INSTDIR\ConnecTra.exe"
  
  WriteRegStr HKCU "Software\ConnecTra" "" $INSTDIR
SectionEnd
