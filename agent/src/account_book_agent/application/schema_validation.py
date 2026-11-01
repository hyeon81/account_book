"""Validate the bounded JSON Schema vocabulary used by our tool catalog."""
import math
import re
from decimal import Decimal


def validate(value, schema):
    if "oneOf" in schema:
        matches = 0
        for option in schema["oneOf"]:
            try: validate(value, option)
            except ValueError: continue
            matches += 1
        if matches != 1: raise ValueError("Invalid period")
        return
    types = schema.get("type")
    if isinstance(types, str): types = [types]
    checks = {"null": value is None, "object": type(value) is dict,
              "array": type(value) is list, "string": type(value) is str,
              "integer": type(value) is int,
              "number": type(value) in (int, float, Decimal) and math.isfinite(value)}
    if types and not any(checks[t] for t in types): raise ValueError("Invalid field type")
    if "enum" in schema and value not in schema["enum"]: raise ValueError("Invalid enum")
    if "const" in schema and value != schema["const"]: raise ValueError("Invalid constant")
    if value is None: return
    if type(value) is dict:
        props = schema.get("properties", {})
        if not set(schema.get("required", [])) <= value.keys(): raise ValueError("Missing field")
        if schema.get("additionalProperties") is False and value.keys() - props.keys():
            raise ValueError("Unexpected field")
        for key, item in value.items():
            if key in props: validate(item, props[key])
    elif type(value) is list:
        if len(value) > schema.get("maxItems", len(value)): raise ValueError("Too many items")
        for item in value: validate(item, schema["items"])
    elif type(value) is str:
        if not schema.get("minLength", 0) <= len(value) <= schema.get("maxLength", len(value)):
            raise ValueError("Invalid length")
        if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
            raise ValueError("Invalid format")
        if "\x00" in value: raise ValueError("Invalid character")
    elif type(value) in (int, float, Decimal):
        if not math.isfinite(value): raise ValueError("Nonfinite number")
        if "minimum" in schema and value < schema["minimum"]: raise ValueError("Below minimum")
        if "maximum" in schema and value > schema["maximum"]: raise ValueError("Above maximum")
