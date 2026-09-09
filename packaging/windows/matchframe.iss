#ifndef MatchframeVersion
  #define MatchframeVersion "0.1.0-alpha.1"
#endif
#ifndef MatchframeFileVersion
  #define MatchframeFileVersion "0.1.0.1"
#endif
#ifndef MatchframeExe
  #define MatchframeExe "..\..\dist\runtime\Matchframe.exe"
#endif

[Setup]
AppId={{B3E19F4A-7C2D-4E8A-9F1B-6D5C8A2E4B71}
AppName=Matchframe
AppVersion={#MatchframeVersion}
AppVerName=Matchframe {#MatchframeVersion}
AppPublisher=Matchframe
AppCopyright=Copyright © 2026 Matchframe contributors
AppComments=Local-first CS2 broadcast overlay
VersionInfoVersion={#MatchframeFileVersion}
VersionInfoProductName=Matchframe
VersionInfoProductVersion={#MatchframeFileVersion}
VersionInfoDescription=Matchframe Broadcast Overlay
VersionInfoCompany=Matchframe
DefaultDirName={localappdata}\Programs\Matchframe
DefaultGroupName=Matchframe
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=matchframe.ico
UninstallDisplayIcon={app}\Matchframe.exe
OutputDir=..\..\dist\release
OutputBaseFilename=Matchframe-Setup-{#MatchframeVersion}-win-x64
LicenseFile=..\..\LICENSE
InfoBeforeFile=
CloseApplications=yes
UsedUserAreasWarning=no
DisableWelcomePage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
ConfirmUninstall=Remove Matchframe from this computer?%n%nBroadcast data in %LOCALAPPDATA%\Matchframe will be kept. Matchframe's CS2 GSI configuration may remain installed in CS2.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start Matchframe when Windows starts"; GroupDescription: "Additional options:"; Flags: unchecked

[Files]
Source: "{#MatchframeExe}"; DestDir: "{app}"; DestName: "Matchframe.exe"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Matchframe"; Filename: "{app}\Matchframe.exe"
Name: "{autodesktop}\Matchframe"; Filename: "{app}\Matchframe.exe"; Tasks: desktopicon
Name: "{userstartup}\Matchframe"; Filename: "{app}\Matchframe.exe"; Parameters: "--no-browser"; Tasks: startupicon

[Run]
Filename: "{app}\Matchframe.exe"; Description: "Launch Matchframe"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{userstartup}\Matchframe.lnk"
