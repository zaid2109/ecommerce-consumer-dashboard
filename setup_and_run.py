import os
import sys
import subprocess


def run_command(command):
    """Run a shell command and handle errors."""
    try:
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)


def setup_environment():
    """Setup the environment for the E-Commerce Consumer Dashboard."""
    print("Setting up the environment...")
    run_command(['pip', 'install', '-r', 'requirements.txt'])


def run_application():
    """Run the E-Commerce Consumer Dashboard application."""
    print("Starting the application...")
    run_command(['python', 'app.py'])


def main():
    """Main function to setup and run the application."""
    setup_environment()
    run_application()


if __name__ == '__main__':
    main()