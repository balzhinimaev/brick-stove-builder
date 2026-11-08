import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { translations } from "../../i18n";
import { AuthScreen } from "../AuthScreen";

it.each(["login", "register"] as const)("keeps username entry literal and autofill available in %s mode", (mode) => {
  const html = renderToStaticMarkup(
    <AuthScreen
      mode={mode}
      setMode={() => {}}
      login="stove_owner"
      setLogin={() => {}}
      password=""
      setPassword={() => {}}
      onSubmit={() => {}}
      t={(key) => translations.ru[key]}
    />
  );
  const inputs = html.match(/<input\b[^>]*>/g) ?? [];
  const username = inputs.find((input) => input.includes('autoComplete="username"'));
  expect(username).toBeDefined();
  expect(username).toContain('autoCapitalize="none"');
  expect(username).toContain('autoCorrect="off"');
  expect(username).toContain('spellCheck="false"');
  expect(inputs.find((input) => input.includes('type="password"'))).toContain(
    `autoComplete="${mode === "register" ? "new-password" : "current-password"}"`
  );
});

it("shows inline errors and disables submission while signing in", () => {
  const html = renderToStaticMarkup(
    <AuthScreen
      mode="register"
      setMode={() => {}}
      login="tester"
      setLogin={() => {}}
      password=""
      setPassword={() => {}}
      onSubmit={() => {}}
      t={(key) => translations.ru[key]}
      busy
      error="Сервис недоступен"
      remember={false}
      setRemember={() => {}}
    />
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).toMatch(/<fieldset[^>]*disabled/);
  expect(html).toContain('role="alert"');
  expect(html).toContain("Сервис недоступен");
  expect(html).toContain('name="password-confirmation"');
  expect(html).toContain('type="checkbox"');
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
});
