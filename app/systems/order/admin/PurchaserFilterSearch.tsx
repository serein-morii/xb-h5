import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DataRow } from "./core";

type Props = {
  value?: unknown;
  purchasers: DataRow[];
  onChange: (value: string) => void;
};

function purchaserLabel(item: DataRow) {
  const name = String(item.name || "未命名");
  const phone = String(item.phone || "");
  return phone ? `${name} · ${phone}` : name;
}

function purchaserSearchText(item: DataRow) {
  return [
    item.name,
    item.phone,
    item.shortId,
    item.storeName,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

export default function PurchaserFilterSearch({ value, purchasers, onChange }: Props) {
  const selectedValue = String(value || "");
  const selected = useMemo(
    () => purchasers.find((item) => String(item.name || "") === selectedValue),
    [purchasers, selectedValue],
  );
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setKeyword(selectedValue ? (selected ? purchaserLabel(selected) : selectedValue) : "");
  }, [selected, selectedValue]);

  const visiblePurchasers = useMemo(() => {
    const words = keyword.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = words.length
      ? purchasers.filter((item) => {
        const text = purchaserSearchText(item);
        return words.every((word) => text.includes(word));
      })
      : purchasers;
    return rows.slice(0, 30);
  }, [keyword, purchasers]);

  function clear() {
    setKeyword("");
    onChange("");
    setOpen(true);
  }

  return (
    <div className="filter-purchaser-search">
      <div className="filter-purchaser-control">
        <Search size={14} />
        <input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            if (selectedValue) onChange("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={purchasers.length ? "搜索姓名 / 手机号 / 短 ID" : "买家列表加载中"}
          autoComplete="off"
        />
        {keyword || selectedValue ? (
          <button type="button" className="filter-purchaser-clear" onClick={clear} aria-label="清空买家筛选">
            <X size={13} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="filter-purchaser-menu">
          <button
            type="button"
            className={!selectedValue ? "active" : ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
          >
            <span>全部买家</span>
            <small>{purchasers.length} 个已加载</small>
          </button>
          {visiblePurchasers.map((item) => {
            const itemValue = String(item.name || "");
            return (
              <button
                type="button"
                key={String(item.id || item.shortId || item.phone || itemValue)}
                className={selectedValue === itemValue ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(itemValue);
                  setKeyword(purchaserLabel(item));
                  setOpen(false);
                }}
              >
                <span>{item.name || "未命名"}</span>
                <small>{[item.phone, item.shortId ? `ID ${item.shortId}` : "", item.storeName].filter(Boolean).join(" · ") || "暂无更多信息"}</small>
              </button>
            );
          })}
          {purchasers.length && !visiblePurchasers.length ? <p>没有匹配的买家</p> : null}
          {purchasers.length > visiblePurchasers.length ? <em>仅显示前 {visiblePurchasers.length} 个，请继续输入缩小范围</em> : null}
        </div>
      ) : null}
    </div>
  );
}
