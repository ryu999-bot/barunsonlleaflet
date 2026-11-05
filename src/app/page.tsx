"use client";

import { useState, useEffect, FormEvent } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const QUANTITIES = Array.from({ length: 10 }, (_, i) => (i + 1) * 50);

// 리플렛 제작 소요 기간 (영업일)
const PRODUCTION_BUSINESS_DAYS = 10;

// 로컬(한국) 날짜 기준 yyyy-MM-dd (toISOString은 UTC라 오전 9시 전엔 하루 밀림)
function toDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isWeekend(d: Date) {
  return d.getDay() === 0 || d.getDay() === 6;
}

// 오늘 다음 날부터 target 당일까지의 영업일(주말 제외) 수
function businessDaysUntil(target: string) {
  const end = new Date(`${target}T00:00:00`);
  if (isNaN(end.getTime())) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) count++;
  }
  return count;
}

// 기본값: 제작 기간(영업일 10일)을 넘긴 첫 영업일 → 안내 경고가 뜨지 않는 가장 빠른 날짜
function getDefaultDeadline() {
  const d = new Date();
  let added = 0;
  while (added <= PRODUCTION_BUSINESS_DAYS) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return toDateString(d);
}

declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: { zonecode: string; address: string }) => void;
      }) => { open: () => void };
    };
  }
}

export default function Home() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [zonecode, setZonecode] = useState("");
  const [address, setAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [today, setToday] = useState("");

  // 페이지는 빌드 시 미리 렌더링되므로 날짜 기본값은 브라우저에서 계산
  useEffect(() => {
    setToday(toDateString(new Date()));
    setDeadline(getDefaultDeadline());
  }, []);

  const daysUntilDeadline = deadline ? businessDaysUntil(deadline) : null;
  const isTightDeadline = daysUntilDeadline !== null && daysUntilDeadline <= PRODUCTION_BUSINESS_DAYS;

  function handleAddressSearch() {
    new window.daum.Postcode({
      oncomplete(data) {
        setZonecode(data.zonecode);
        setAddress(data.address);
        document.getElementById("addressDetail")?.focus();
      },
    }).open();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSubmitting(true);
    setResult(null);

    const formData = new FormData(form);

    try {
      const res = await fetch(`${BASE_PATH}/api/submit`, { method: "POST", body: formData });
      if (res.ok) {
        setResult("success");
        form.reset();
        setDeadline(getDefaultDeadline());
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 py-8 px-4 sm:py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            바른손 리플렛 제작 신청
          </h1>
          <p className="mt-2 text-gray-600">
            아래 양식을 작성하여<br className="sm:hidden" /> 리플렛 제작을 신청해 주세요.
          </p>
        </div>

        {/* Result Messages */}
        {result === "success" && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
            신청이 완료되었습니다.<br className="sm:hidden" /> 담당자가 확인 후 연락드리겠습니다.
          </div>
        )}
        {result === "error" && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
            신청 중 오류가 발생했습니다.<br className="sm:hidden" /> 다시 시도해 주세요.
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-5 shadow-sm border border-gray-200 sm:p-8"
        >
          {/* 기본 정보 */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              기본 정보
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  회사명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
                  담당자명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="contactName"
                  name="contactName"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  placeholder="010-0000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주소 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={zonecode}
                    readOnly
                    placeholder="우편번호"
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-gray-50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                  >
                    주소 검색
                  </button>
                </div>
                <input
                  type="text"
                  value={address}
                  readOnly
                  placeholder="기본 주소"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-gray-50 outline-none mb-2"
                />
                <input
                  type="text"
                  id="addressDetail"
                  name="addressDetail"
                  placeholder="상세 주소를 입력해주세요"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <input type="hidden" name="address" value={address ? `(${zonecode}) ${address}` : ""} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="partnerCode" className="block text-sm font-medium text-gray-700 mb-1">
                  제휴사 코드 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="partnerCode"
                  name="partnerCode"
                  required
                  placeholder="제휴사 코드를 입력해주세요"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </fieldset>

          {/* 리플렛 정보 */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              리플렛 정보
            </legend>
            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
                  용도 <span className="text-red-500">*</span>
                </span>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="purpose"
                      value="리플렛"
                      required
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">리플렛</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                    수량
                  </label>
                  <select
                    id="quantity"
                    name="quantity"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    size={1}
                  >
                    <option value="">선택해주세요</option>
                    {QUANTITIES.map((q) => (
                      <option key={q} value={`${q}부`}>{q}부</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                    납기 희망일
                  </label>
                  <input
                    type="date"
                    id="deadline"
                    name="deadline"
                    value={deadline}
                    min={today || undefined}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  {isTightDeadline ? (
                    <p role="alert" className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800">
                      <span className="block">선택하신 날짜는 영업일 기준 {daysUntilDeadline}일 후입니다.</span>
                      <span className="mt-1 block break-keep font-normal">
                        리플렛 제작에는 영업일 기준 약 10일이 소요되어 가급적 여유있는 일정으로 신청 부탁드립니다.
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                      리플렛은 신청일로부터<br /> 영업일 기준 10일 내외로 발송됩니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </fieldset>

          {/* 파일 첨부 */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              참고 파일 첨부
            </legend>
            <div>
              <input
                type="file"
                id="file"
                name="file"
                accept=".pdf,.jpg,.jpeg,.png,.ai,.psd,.zip"
                className="w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                PDF, JPG, PNG, AI, PSD, ZIP (최대 10MB)
              </p>
            </div>
          </fieldset>

          {/* 추가 요청사항 */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              추가 요청사항
            </legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  특이사항
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder="요청사항이나 특이사항을 자유롭게 적어주세요."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
                  유선 연락 요청 유무 <span className="text-red-500">*</span>
                </span>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="phoneCallRequest"
                      value="요청"
                      required
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">요청</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="phoneCallRequest"
                      value="불필요"
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">불필요</span>
                  </label>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "신청 중..." : "제작 신청하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          문의사항은 아래 담당자 메일로 연락해 주세요.
          <br />
          <a href="mailto:wooram.jeon@barunn.net" className="text-blue-600 underline hover:text-blue-700">
            wooram.jeon@barunn.net
          </a>
        </p>
      </div>
    </div>
  );
}
