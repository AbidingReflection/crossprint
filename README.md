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

## Targeted Transformations

Each stage can be performed independently or in sequence:

| Transformation       | Purpose                                                        | User Control                                        |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| **Deskew**           | Correct perspective distortion by defining four corner points. | Manual point placement on image.                    |
| **Crop**             | Trim borders or isolate the puzzle grid.                       | Edge handles, numeric inputs, and per-edge sliders. |
| **B/W Thresholding** | Convert the image to high-contrast black and white for print.  | Adjustable slider with optional Otsu auto-detect.   |
| **Export**           | Save the processed image to the `output/` directory.           | Auto-generated filename with timestamp.             |

