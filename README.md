# CrossPrint

Convert photographed crosswords into clean, high-contrast grayscale images.  
Built with **Python**, **Pillow**, and **scikit-image**, featuring a local **pywebview** interface for precise deskewing and enhancement.

## Setup

```bash
# Clone and enter
git clone git@github.com:AbidingReflection/crossprint.git
cd crossprint
````

## Launch

### Windows

```bash
launch_UI.bat
```

### macOS / Linux

```bash
./launch_UI.sh
```

Both scripts:

* Use `.venv` or `venv` if present (create `.venv` if not)
* Install dependencies from `requirements.txt`
* Launch the local CrossPrint UI

## Input & Output

* Place source images in `input/`
* Processed files are saved to `output/`

```
