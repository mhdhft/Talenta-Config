import pandas as pd


def clean_value(value):
    """Ubah NaN/NaT hasil baca pandas jadi None, sisanya dikembalikan apa adanya."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    return value


def clean_str(value) -> str | None:
    value = clean_value(value)
    return None if value is None else str(value)
