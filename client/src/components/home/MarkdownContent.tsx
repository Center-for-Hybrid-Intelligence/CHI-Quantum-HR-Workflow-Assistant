import { Separator } from "@/components/ui/separator";

function renderInline(text: string) {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        const italicMatch = remaining.match(/\*(.+?)\*/);
        const codeMatch = remaining.match(/`([^`]+)`/);

        let firstMatch: { index: number; length: number; element: JSX.Element } | null = null;

        if (boldMatch && boldMatch.index !== undefined) {
            firstMatch = {
                index: boldMatch.index,
                length: boldMatch[0].length,
                element: (
                    <strong key={key++} className="font-semibold">
                        {boldMatch[1]}
                    </strong>
                ),
            };
        }
        if (codeMatch && codeMatch.index !== undefined) {
            const candidate = {
                index: codeMatch.index,
                length: codeMatch[0].length,
                element: (
                    <code
                        key={key++}
                        className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono"
                    >
                        {codeMatch[1]}
                    </code>
                ),
            };
            if (!firstMatch || candidate.index < firstMatch.index) firstMatch = candidate;
        }
        if (
            italicMatch &&
            italicMatch.index !== undefined &&
            (!boldMatch || italicMatch.index !== boldMatch.index)
        ) {
            const candidate = {
                index: italicMatch.index,
                length: italicMatch[0].length,
                element: (
                    <em key={key++} className="italic">
                        {italicMatch[1]}
                    </em>
                ),
            };
            if (!firstMatch || candidate.index < firstMatch.index) firstMatch = candidate;
        }

        if (firstMatch) {
            if (firstMatch.index > 0) {
                parts.push(remaining.slice(0, firstMatch.index));
            }
            parts.push(firstMatch.element);
            remaining = remaining.slice(firstMatch.index + firstMatch.length);
        } else {
            parts.push(remaining);
            break;
        }
    }

    return <>{parts}</>;
}

export function MarkdownTable({ rows }: { rows: string[][] }) {
    if (rows.length < 2) return null;
    const headers = rows[0];
    const dataRows = rows.slice(1);

    return (
        <div className="my-3 overflow-x-auto rounded-md border" data-testid="markdown-table">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-muted/50">
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-semibold border-b text-xs">
                                {renderInline(h.trim())}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {dataRows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                            {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 border-b text-xs leading-relaxed">
                                    {renderInline(cell.trim())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function MarkdownContent({ content }: { content: string }) {
    const cleanContent = content
        .replace(/<!--BMC_START-->[\s\S]*?<!--BMC_END-->/, "")
        .trim();

    const lines = cleanContent.split("\n");
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let tableRows: string[][] = [];

    const flushList = () => {
        if (listItems.length > 0 && listType) {
            const Tag = listType;
            elements.push(
                <Tag
                    key={`list-${elements.length}`}
                    className={`${listType === "ul" ? "list-disc" : "list-decimal"} pl-5 my-2 space-y-1`}
                >
                    {listItems.map((item, idx) => (
                        <li key={idx} className="text-sm leading-relaxed">
                            {renderInline(item)}
                        </li>
                    ))}
                </Tag>
            );
            listItems = [];
            listType = null;
        }
    };

    const flushTable = () => {
        if (tableRows.length >= 2) {
            elements.push(<MarkdownTable key={`table-${elements.length}`} rows={tableRows} />);
        }
        tableRows = [];
    };

    const isTableRow = (line: string) => {
        return line.trim().startsWith("|") && line.trim().endsWith("|");
    };

    const isTableSeparator = (line: string) => {
        return /^\|[\s\-:|]+\|$/.test(line.trim());
    };

    const parseTableRow = (line: string): string[] => {
        return line
            .trim()
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim());
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isTableRow(line)) {
            flushList();
            if (isTableSeparator(line)) {
                continue;
            }
            tableRows.push(parseTableRow(line));
            if (i + 1 >= lines.length || !isTableRow(lines[i + 1])) {
                flushTable();
            }
            continue;
        }

        flushTable();

        const ulMatch = line.match(/^[\s]*[-*]\s+(.*)/);
        const olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);

        if (ulMatch) {
            if (listType !== "ul") flushList();
            listType = "ul";
            listItems.push(ulMatch[1]);
            continue;
        }
        if (olMatch) {
            if (listType !== "ol") flushList();
            listType = "ol";
            listItems.push(olMatch[1]);
            continue;
        }

        flushList();

        if (line.startsWith("### ")) {
            elements.push(
                <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
                    {renderInline(line.slice(4))}
                </h3>
            );
        } else if (line.startsWith("## ")) {
            elements.push(
                <h2 key={i} className="text-base font-semibold mt-4 mb-1.5">
                    {renderInline(line.slice(3))}
                </h2>
            );
        } else if (line.startsWith("# ")) {
            elements.push(
                <h1 key={i} className="text-lg font-bold mt-4 mb-2">
                    {renderInline(line.slice(2))}
                </h1>
            );
        } else if (line.trim() === "---") {
            elements.push(<Separator key={i} className="my-3" />);
        } else if (line.trim() === "") {
            elements.push(<div key={i} className="h-2" />);
        } else {
            elements.push(
                <p key={i} className="text-sm leading-relaxed">
                    {renderInline(line)}
                </p>
            );
        }
    }
    flushList();
    flushTable();

    return <div className="space-y-0.5">{elements}</div>;
}
