import sys
import multiprocessing
from PyQt6.QtWidgets import QApplication
from components.main_window import MainWindow

def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == '__main__':
    # https://github.com/pyinstaller/pyinstaller/wiki/Recipe-Multiprocessing
    multiprocessing.freeze_support()
    main()
