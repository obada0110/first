# حزمة مصدر MAX EDITOR Android

هذه حزمة مصدر كاملة قابلة للفتح والبناء، وليست APK للتثبيت.

## المحتويات
- `max-motion/mobile/`: Flutter/Dart وKotlin وموارد Android واختبارات الوحدة والتكامل وأدوات QA.
- `max-motion/contract/`: مخطط مشروع v1، محوّلات Android/Kotlin، fixtures واختبارات العقد.
- `max-motion/core-kmp/`: منطق جلسة مشروع v1 المشترك المستعمل من تطبيق Android.
- `.github/workflows/`: بوابتا Android foundation وPhase 3A integration.
- تقارير الحالة وتعليمات البناء.

## البناء
المتطلبات الموثقة: Flutter 3.38.3 stable، JDK 17، Android SDK، ومنصة أدوات البناء التي يطلبها Flutter. افتح `max-motion/mobile/` ثم نفّذ `flutter pub get`, `flutter gen-l10n`, `flutter analyze`, `flutter test`, و`flutter build apk --debug`.

لتجميع APK تجريبي منفصل بعلم مشروع v1:
`ORG_GRADLE_PROJECT_maxCoreEditorEnabled=true flutter build apk --debug`

البناء التجريبي يستخدم suffix `.phase3a`. علم الميزة في البناء العادي وRelease يبقى معطّلًا.

## الحالة والتحذيرات
الحالة التفصيلية في `max-motion/ANDROID-STATUS-REPORT-AR.md` وPDF المرفق. آخر بوابة تكامل معروفة (run `44988808882`, commit `89cf0cb`) نجحت في التحليل والبناء وفشلت في الاختبار على المحاكي لأن زر `core-add` لم يظهر بعد استعادة الفيديو. يوجد في مصدر الاختبار المضمّن تشخيص محلي غير مدفوع وغير مختبر. لذلك لا تعتبر الحزمة إصدارًا إنتاجيًا أو نجاحًا معتمدًا.

يجب إجراء اختبار منفصل على جهاز Android فعلي قبل أي ادعاء أداء أو إصدار نهائي. لا تتضمن الحزمة ملف APK أو ملفات البناء/الكاش أو مجلد `.git`.
