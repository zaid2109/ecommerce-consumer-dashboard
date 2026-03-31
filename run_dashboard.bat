@echo off

:: Set the project directory relative to the script's location
set "PROJECT_DIR=%~dp0..\..\Ecommerce consumer behaviour dashboard"

:: Check if the project directory exists
if not exist "%PROJECT_DIR%" (
    echo Error: Project directory does not exist.
    exit /b 1
)

:: Additional commands can follow here...