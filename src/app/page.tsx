"use client";

import { useState, FormEvent } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const QUANTITIES = Array.from({ length: 50 }, (_, i) => (i + 1) * 50);

function getDefaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().split("T")[0];
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
    <div className="min-h-full bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            바른손 리플렛 제작 신청
          </h1>
          <p className="mt-2 text-gray-600">
            아래 양식을 작성하여 리플렛 제작을 신청해 주세요.
          </p>
        </div>

        {/* Result Messages */}
        {result === "success" && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
            신청이 완료되었습니다. 담당자가 확인 후 연락드리겠습니다.
          </div>
        )}
        {result === "error" && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
            신청 중 오류가 발생했습니다. 다시 시도해 주세요.
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl bg-white p-8 shadow-sm border border-gray-200"
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
                  제휴사 코드
                </label>
                <input
                  type="text"
                  id="partnerCode"
                  name="partnerCode"
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
                      value="샘플팩"
                      required
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">샘플팩</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="purpose"
                      value="리플렛"
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
                    납기일
                  </label>
                  <input
                    type="date"
                    id="deadline"
                    name="deadline"
                    defaultValue={getDefaultDeadline()}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
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
          문의사항은 담당자에게 연락해 주세요.
        </p>
      </div>
    </div>
  );
}
