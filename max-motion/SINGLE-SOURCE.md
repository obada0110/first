# سجل المشروع — اعتماد العقد v1 والحزمة الثانية

اعتمد المدير Project Contract v1. تبقى آخر لقطة بعد إغلاق التطبيق، لا سجلا Undo/Redo. إلغاء الكتابة الجزئية ليس اختبار انقطاع الطاقة. تحقق العقد السابق على محاكي API 35 وليس على هاتف. صيانة CI: استبدال checkout v4 وupload-artifact v4 بنسختي Node 24؛ لا تعديل لمحرر الويب. لا تغيير في مخطط أو قواعد العقد.

المسار الحالي مشروع محلي واحد. منتقي OPEN_DOCUMENT يمنح قراءة URI مستمرة؛ عند اختيار بديل ناجح فقط تُستبدل اللقطة. لا نسخ للأصل. التحديد محفوظ بوحدة µs في inUs/outUs من v1؛ ربط assetId بعنوان SAF منفصل عن بيانات التحرير. معدل مصدر غير معروف يظهر كغير متاح. fps في العقد شبكة زمن للمشروع وليس وعدًا بإعادة أخذ عينات الفيديو. المعاينة للأصل كاملاً. التصدير يحتفظ بتوقيت العينات؛ قد يختلف طرف الملف بما يصل إلى زمن عينة. تصدير foreground، لا خدمة خلفية. لا طبقات أو مفاتيح أو مؤثرات أو Undo جديد بالواجهة.

## إعادة التشغيل

بيئة CI المثبتة: Flutter 3.38.3، JDK 17، SDK 36، Gradle 8.14، Kotlin 2.2.20. أضيفت Media3 ExoPlayer/UI/Transformer 1.6.1 فقط واعتماد JSON 1.8.1 المستخدم أصلاً في اختبارات العقد. لا خدمات خارجية أثناء الاستخدام. لا تطلب نسخة الإنتاج إذن قراءة المكتبة العامة. API 29+ ينشر في Movies/MAX EDITOR عبر MediaStore.IS_PENDING؛ API 24–28 يطلب مجلدًا من المستخدم وينشئ مستندًا جديدًا دون إذن تخزين شامل.

- داخل `max-motion/mobile`: شغّل `flutter pub get && flutter gen-l10n && flutter analyze && flutter test && flutter build apk --debug`.
- على محاكي API 35: شغّل اختبار اللغة بـ `flutter test --no-pub integration_test/language_android_test.dart -d emulator-5554`، والعقد من `android/` بالأمر `./gradlew :contractCheck:connectedDebugAndroidTest`.
- لتشغيل حزمة الوسائط في بيئة Linux فيها adb وFFmpeg وPython: احفظ APK العادي قبل اختبارات Flutter في `$RUNNER_TEMP/normal.apk` ثم نفّذ `bash tool/single_qa/device.sh`. تُنشأ العينات محليًا وتُفحص النتائج في `$RUNNER_TEMP/single-qa/evidence`. استخدم محاكيًا تجريبيًا فارغًا؛ اختبار الاستعادة يمسح بيانات التطبيق التجريبي ويستخدم ملفات باسم mx- داخل Download.
