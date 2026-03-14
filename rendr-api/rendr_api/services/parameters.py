"""OpenSCAD parameter extraction — port of CADAM's parseParameter.ts."""

import re

from rendr_api.models.responses import Parameter, ParameterOption, ParameterRange


def parse_parameters(code: str) -> list[Parameter]:
    """Extract adjustable parameters from OpenSCAD code.

    Supports: numbers, booleans, strings, arrays.
    Reads inline comments for: ranges (min:step:max), options, descriptions.
    Groups via /* [GroupName] */ comments.
    """
    # Limit to code before first module/function definition
    parts = re.split(r"^(module |function )", code, maxsplit=1, flags=re.MULTILINE)
    header = parts[0]

    # Find group markers: /* [Group Name] */
    group_regex = re.compile(r"^/\*\s*\[([^\]]+)\]\s*\*/", re.MULTILINE)
    group_sections: list[dict] = [{"id": "", "group": "", "code": header}]

    for m in group_regex.finditer(header):
        group_sections.append({"id": m.group(0), "group": m.group(1).strip(), "code": ""})

    # Assign code ranges to group sections
    for i, section in enumerate(group_sections):
        start = header.index(section["id"]) if section["id"] else 0
        if i + 1 < len(group_sections):
            end = header.index(group_sections[i + 1]["id"])
        else:
            end = len(header)
        section["code"] = header[start:end]

    # If multiple groups, trim first section to end before second group
    if len(group_sections) > 1:
        group_sections[0]["code"] = header[: header.index(group_sections[1]["id"])]

    param_regex = re.compile(
        r"^([a-zA-Z0-9_$]+)\s*=\s*([^;]+);[\t\f\x0b ]*(//[^\n]*)?", re.MULTILINE
    )

    parameters: dict[str, Parameter] = {}

    for section in group_sections:
        for match in param_regex.finditer(section["code"]):
            name = match.group(1)
            raw_value = match.group(2).strip()
            comment = match.group(3)

            type_and_value = _convert_type(raw_value)
            if type_and_value is None:
                continue

            param_type, value = type_and_value

            # Skip if value looks like a variable reference or expression
            if (
                raw_value not in ("true", "false")
                and re.match(r"^[a-zA-Z_]", raw_value)
                or "\n" in raw_value
            ):
                continue

            description: str | None = None
            options: list[ParameterOption] = []
            param_range = ParameterRange()

            # Parse inline comment
            if comment:
                raw_comment = re.sub(r"^//\s*", "", comment).strip()
                cleaned = raw_comment.strip("[]")

                if _is_number(raw_comment):
                    if param_type == "string":
                        param_range = ParameterRange(max=float(cleaned))
                    else:
                        param_range = ParameterRange(step=float(cleaned))
                elif raw_comment.startswith("[") and "," in cleaned:
                    # Options: [value1:Label 1, value2:Label 2]
                    for opt_str in cleaned.split(","):
                        opt_parts = opt_str.strip().split(":", 1)
                        opt_value: str | float = opt_parts[0]
                        opt_label = opt_parts[1] if len(opt_parts) > 1 else None
                        if param_type == "number":
                            try:
                                opt_value = float(opt_value)
                            except ValueError:
                                pass
                        options.append(ParameterOption(value=opt_value, label=opt_label))
                elif (range_match := re.match(r"(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)", cleaned)):
                    # Range: min:step:max
                    param_range = ParameterRange(
                        min=float(range_match.group(1)),
                        step=float(range_match.group(2)),
                        max=float(range_match.group(3)),
                    )
                elif (range_match := re.match(r"(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)", cleaned)):
                    # Range: min:max
                    param_range = ParameterRange(
                        min=float(range_match.group(1)), max=float(range_match.group(2))
                    )

            # Check for description comment above the parameter
            before = header.split(match.group(0))[0]
            if before.endswith("\n"):
                before = before[:-1]
            lines = before.split("\n")
            if lines:
                last_line = lines[-1].strip()
                if last_line.startswith("//"):
                    desc = re.sub(r"^///*\s*", "", last_line)
                    if desc:
                        description = desc

            # Build display name
            if name == "$fn":
                display_name = "Resolution"
            else:
                display_name = " ".join(
                    word.capitalize() for word in name.replace("_", " ").split()
                )

            has_range = (
                param_range.min is not None
                or param_range.max is not None
                or param_range.step is not None
            )

            parameters[name] = Parameter(
                name=name,
                display_name=display_name,
                type=param_type,
                value=value,
                default_value=value,
                description=description,
                group=section["group"],
                range=param_range if has_range else None,
                options=options,
            )

    return list(parameters.values())


def apply_parameter_updates(code: str, updates: list[dict]) -> str:
    """Apply parameter value updates to OpenSCAD code via regex replacement."""
    for update in updates:
        name = re.escape(update["name"])
        pattern = re.compile(
            rf"^({name}\s*=\s*)([^;]+)(;.*)", re.MULTILINE
        )
        code = pattern.sub(rf"\g<1>{update['value']}\3", code, count=1)
    return code


def _convert_type(raw: str) -> tuple[str, str | float | bool | list] | None:
    """Determine parameter type and parse value."""
    if re.match(r"^-?\d+(\.\d+)?$", raw):
        return ("number", float(raw))
    if raw in ("true", "false"):
        return ("boolean", raw == "true")
    if re.match(r'^".*"$', raw):
        return ("string", raw.strip('"'))
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1]
        items = [item.strip() for item in inner.split(",") if item.strip()]
        if not items:
            return None
        if all(re.match(r"^-?\d+(\.\d+)?$", i) for i in items):
            return ("number[]", [float(i) for i in items])
        if all(re.match(r'^".*"$', i) for i in items):
            return ("string[]", [i.strip('"') for i in items])
        if all(i in ("true", "false") for i in items):
            return ("boolean[]", [i == "true" for i in items])
        return None
    return None


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False
