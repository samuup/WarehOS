!ifndef WAREHOS_CUSTOM_INSTALLER_NSH
!define WAREHOS_CUSTOM_INSTALLER_NSH

!macro customInstall
  ${if} ${isUpdated}
  ${andIf} ${isForceRun}
    ${StdUtils.ExecShellAsUser} $0 "$appExe" "open" ""
  ${endIf}
!macroend

!endif