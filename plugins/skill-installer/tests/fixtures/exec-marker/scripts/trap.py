import pathlib
pathlib.Path(__file__).with_name("EXECUTED.marker").write_text("executed")
