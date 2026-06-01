from __future__ import annotations

import io
import re
import zipfile
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple
from xml.etree import ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "c16r2": "http://schemas.microsoft.com/office/drawing/2015/06/chart",
}
ET.register_namespace("", NS["main"])
ET.register_namespace("c", NS["c"])
ET.register_namespace("a", NS["a"])
ET.register_namespace("r", NS["r"])
ET.register_namespace("c16r2", NS["c16r2"])


MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def as_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def fmt(value: Any, decimals: int = 2) -> str:
    return f"{as_float(value):,.{decimals}f}".replace(",", " ")


def col_to_number(col: str) -> int:
    total = 0
    for char in col:
        total = total * 26 + ord(char.upper()) - 64
    return total


def split_cell(cell: str) -> Tuple[str, int]:
    match = re.match(r"^([A-Z]+)(\d+)$", cell)
    if not match:
        raise ValueError(f"Adresa celula invalida: {cell}")
    return match.group(1), int(match.group(2))


def row_number(cell: str) -> int:
    return split_cell(cell)[1]


def cell_sort_key(cell: str) -> Tuple[int, int]:
    col, row = split_cell(cell)
    return row, col_to_number(col)


def q(tag: str) -> str:
    return f"{{{NS['main']}}}{tag}"


def cq(tag: str) -> str:
    return f"{{{NS['c']}}}{tag}"


def aq(tag: str) -> str:
    return f"{{{NS['a']}}}{tag}"


def find_or_create_row(sheet: ET.Element, index: int) -> ET.Element:
    sheet_data = sheet.find("main:sheetData", NS)
    if sheet_data is None:
        sheet_data = ET.SubElement(sheet, q("sheetData"))

    for row in sheet_data.findall("main:row", NS):
        if int(row.attrib.get("r", "0")) == index:
            return row

    new_row = ET.Element(q("row"), {"r": str(index)})
    rows = sheet_data.findall("main:row", NS)
    inserted = False
    for pos, row in enumerate(rows):
        if int(row.attrib.get("r", "0")) > index:
            sheet_data.insert(pos, new_row)
            inserted = True
            break
    if not inserted:
        sheet_data.append(new_row)
    return new_row


def find_or_create_cell(sheet: ET.Element, ref: str) -> ET.Element:
    col, row_idx = split_cell(ref)
    row = find_or_create_row(sheet, row_idx)
    for cell in row.findall("main:c", NS):
        if cell.attrib.get("r") == ref:
            return cell

    new_cell = ET.Element(q("c"), {"r": ref})
    cells = row.findall("main:c", NS)
    inserted = False
    for pos, cell in enumerate(cells):
        existing_ref = cell.attrib.get("r", "")
        existing_col = split_cell(existing_ref)[0] if existing_ref else ""
        if existing_col and col_to_number(existing_col) > col_to_number(col):
            row.insert(pos, new_cell)
            inserted = True
            break
    if not inserted:
        row.append(new_cell)
    return new_cell


def clear_cell(cell: ET.Element) -> None:
    style = cell.attrib.get("s")
    ref = cell.attrib.get("r")
    cell.attrib.clear()
    if ref:
        cell.attrib["r"] = ref
    if style:
        cell.attrib["s"] = style
    for child in list(cell):
        cell.remove(child)


def set_cell(sheet: ET.Element, ref: str, value: Any) -> None:
    cell = find_or_create_cell(sheet, ref)
    clear_cell(cell)
    if value is None or value == "":
        return
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        ET.SubElement(cell, q("v")).text = f"{float(value):.12g}"
        return

    cell.attrib["t"] = "inlineStr"
    inline = ET.SubElement(cell, q("is"))
    text = ET.SubElement(inline, q("t"))
    text.text = str(value)
    if str(value).strip() != str(value):
        text.attrib["{http://www.w3.org/XML/1998/namespace}space"] = "preserve"


def set_cells(sheet: ET.Element, values: Dict[str, Any]) -> None:
    for ref, value in sorted(values.items(), key=lambda item: cell_sort_key(item[0])):
        set_cell(sheet, ref, value)


def update_chart_title(chart_xml: bytes, title: str) -> bytes:
    root = ET.fromstring(chart_xml)
    title_node = root.find(".//c:chart/c:title", NS)
    if title_node is None:
        return chart_xml
    tx = title_node.find("c:tx", NS)
    if tx is None:
        tx = ET.SubElement(title_node, cq("tx"))
    for child in list(tx):
        tx.remove(child)
    rich = ET.SubElement(tx, cq("rich"))
    ET.SubElement(rich, aq("bodyPr"))
    ET.SubElement(rich, aq("lstStyle"))
    paragraph = ET.SubElement(rich, aq("p"))
    run = ET.SubElement(paragraph, aq("r"))
    ET.SubElement(run, aq("rPr"), {"lang": "ro-RO"})
    ET.SubElement(run, aq("t")).text = title
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def observation(reduction: float, diff_vs_contract: float) -> str:
    if diff_vs_contract < 0:
        return "Impact moderat; peste pret contract"
    if reduction >= 130:
        return "Impact ridicat"
    if reduction >= 100:
        return "Impact bun"
    return "Impact moderat"


def build_cell_values(summary: Dict[str, Any]) -> Dict[str, Any]:
    assumptions = summary.get("assumptions") or {}
    annual = summary.get("annual") or {}
    battery = summary.get("battery") or {}
    interpretation = summary.get("interpretation") or {}
    monthly = summary.get("monthly") or []

    client = assumptions.get("client") or "Client"
    scenario = summary.get("scenarioName") or "-"
    ac_mw = as_float(battery.get("acMw"))
    storage_mwh = as_float(battery.get("storageMwh"))
    contract_price = as_float(annual.get("contract_price_lei_mwh") or assumptions.get("contractPriceLeiMwh"))
    eur_rate = as_float(assumptions.get("eurRate")) or 5.1
    investment = as_float(annual.get("investment_eur") or assumptions.get("investmentEur"))

    values: Dict[str, Any] = {
        "A1": (
            f"Sinteza financiara  - Client {client} | capacitate baterie "
            f"{fmt(ac_mw, 3)} MW AC - stocare {fmt(storage_mwh, 3)} MWh"
        ),
        "B4": scenario,
        "B5": as_float(annual.get("consumption_mwh")),
        "B6": f"{fmt(interpretation.get('dayPct'), 1)}% / {fmt(interpretation.get('nightPct'), 1)}%",
        "B7": as_float(annual.get("weighted_price_with_bess_lei_mwh")),
        "B8": contract_price,
        "E4": (
            f"1. Simularea indica o reducere medie lunara de "
            f"{fmt(annual.get('reduction_lei_mwh'))} lei/MWh prin utilizarea bateriei."
        ),
        "E6": (
            f"2. Scenariul cu BESS este comparat cu pretul contractual de "
            f"{fmt(contract_price)} lei/MWh."
        ),
        "E7": (
            f"3. Impactul anual indicativ este de aproximativ "
            f"{fmt(annual.get('impact_lei_year'), 0)} lei/an."
        ),
        "B26": contract_price,
        "C26": as_float(annual.get("arithmetic_avg_monthly_without_bess_lei_mwh")),
        "D26": as_float(annual.get("arithmetic_avg_monthly_with_bess_lei_mwh")),
        "E26": as_float(annual.get("reduction_lei_mwh")),
        "F26": as_float(annual.get("difference_vs_contract_lei_mwh")),
        "G26": "Medii simple ale celor 12 luni din simulare",
        "E27": as_float(annual.get("impact_lei_year")),
        "G27": "Consum total x diferenta medie fata de contract",
        "E29": as_float(annual.get("impact_eur_year")),
        "E31": investment,
        "E33": as_float(annual.get("payback_years")) if as_float(annual.get("payback_years")) > 0 else "",
    }

    for index in range(12):
        row = monthly[index] if index < len(monthly) else {}
        excel_row = 12 + index
        month = row.get("month") or MONTHS[index]
        without = as_float(row.get("price_without_bess_lei_mwh"))
        with_bess = as_float(row.get("price_with_bess_lei_mwh"))
        reduction = as_float(row.get("reduction_lei_mwh")) or without - with_bess
        diff = as_float(row.get("difference_vs_contract_lei_mwh")) or contract_price - with_bess
        values.update(
            {
                f"A{excel_row}": month,
                f"B{excel_row}": as_float(row.get("contract_price_lei_mwh")) or contract_price,
                f"C{excel_row}": without,
                f"D{excel_row}": with_bess,
                f"E{excel_row}": reduction,
                f"F{excel_row}": diff,
                f"G{excel_row}": row.get("observation") or observation(reduction, diff),
            }
        )

        helper_row = 43 + index
        values.update(
            {
                f"I{helper_row}": month,
                f"J{helper_row}": as_float(row.get("contract_price_lei_mwh")) or contract_price,
                f"K{helper_row}": without,
                f"L{helper_row}": with_bess,
                f"M{helper_row}": reduction,
            }
        )
        reduction_row = 57 + index
        values.update({f"I{reduction_row}": month, f"J{reduction_row}": reduction})

    return values


def generate_financial_summary_xlsx(summary: Dict[str, Any], template_path: Path) -> bytes:
    if not template_path.exists():
        raise FileNotFoundError(f"Template sinteza lipsa: {template_path}")

    cell_values = build_cell_values(summary)
    assumptions = summary.get("assumptions") or {}
    client = assumptions.get("client") or "Client"
    scenario = summary.get("scenarioName") or "-"
    chart_title = f"{client} - {scenario} | contract vs fara BESS vs cu BESS [lei/MWh]"
    source = template_path.read_bytes()
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(source), "r") as zin, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                root = ET.fromstring(data)
                set_cells(root, cell_values)
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            elif info.filename == "xl/charts/chart1.xml":
                data = update_chart_title(data, chart_title)
            zout.writestr(deepcopy(info), data)
    return output.getvalue()
