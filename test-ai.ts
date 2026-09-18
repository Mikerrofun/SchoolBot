#!/usr/bin/env tsx
/**
 * Тест AI модуля для проверки работы с OpenRouter
 */

// Загружаем переменные окружения из .env
import { config } from "dotenv";
config();

import { checkTextOnTopic, compareHomework } from "./src/lib/ai";

async function testCensorship() {
  console.log("\n🧪 ТЕСТ 1: Проверка цензуры\n");
  
  // Тест 1: Нормальное ДЗ
  console.log("📝 Проверяем нормальное ДЗ...");
  try {
    const result1 = await checkTextOnTopic("Математика страница 45 номер 123-125");
    console.log("✅ Результат:", result1 ? "ПРИНЯТО" : "ОТКЛОНЕНО");
  } catch (error) {
    console.error("❌ Ошибка:", error);
  }

  // Тест 2: Мусор
  console.log("\n📝 Проверяем мусор...");
  try {
    const result2 = await checkTextOnTopic("asdfghjkl qwerty 12345");
    console.log("✅ Результат:", result2 ? "ПРИНЯТО" : "ОТКЛОНЕНО");
  } catch (error) {
    console.error("❌ Ошибка:", error);
  }
}

async function testComparison() {
  console.log("\n\n🧪 ТЕСТ 2: Сравнение ДЗ\n");
  
  const existing = "Математика стр 45 номер 123-125";
  const incoming = "стр. 45 задачи 123-125";
  
  console.log("📚 Существующее ДЗ:", existing);
  console.log("📝 Новое ДЗ:", incoming);
  
  try {
    const result = await compareHomework(existing, incoming);
    if (result) {
      console.log("✅ Результат сравнения:");
      console.log("   - Одинаковые?:", result.same);
      if (result.betterText) {
        console.log("   - Улучшенный текст:", result.betterText);
      }
    } else {
      console.log("⚠️ AI недоступен для сравнения");
    }
  } catch (error) {
    console.error("❌ Ошибка:", error);
  }
}

async function main() {
  console.log("🚀 Запуск тестов AI модуля...");
  console.log("=" .repeat(60));
  
  await testCensorship();
  await testComparison();
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Тесты завершены!");
}

main().catch(console.error);
