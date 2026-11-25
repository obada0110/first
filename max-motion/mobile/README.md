# MAX EDITOR — أساس Android (المرحلة الأولى)

جزء من المشروع الموجود في `max-motion`، وليس بديلًا عن محرر المتصفح. هذه الوحدة تعرض إعدادات اللغة فقط؛ لا تستورد مشروع المتصفح أو تقرأ IndexedDB ولا توفّر مونتاجًا أو تصديرًا. لم نضف مُشغّل فيديو أو Media3 أو خدمات مدفوعة.

## البدء من Android Studio أو VS Code

افتح **هذا المجلد** مع إضافتي Flutter وDart. النسخة المرجعية: Flutter 3.38.3 stable (تتضمن Dart 3.10)، JDK 17 كامل، Android SDK Platform 36، platform-tools، command-line tools، Build Tools 35.0.0 وNDK 28.2.13676358 عند طلبه. Gradle Wrapper 8.14، Android Gradle Plugin 8.11.1 وKotlin 2.2.20 من قالب Flutter لنفس الإصدار. لا يلزم تثبيت Gradle عالميًا. الحد الأدنى Android API 24. التطبيق التجريبي لا يستخدم مفتاح توقيع للنشر التجاري.

```sh
flutter doctor -v
flutter doctor --android-licenses
flutter pub get
flutter gen-l10n
flutter analyze
flutter test
flutter build apk --debug
flutter devices
# عوّض DEVICE_ID بمعرّف فعلي من القائمة، بعد السماح بتصحيح USB أو تشغيل AVD
flutter run -d DEVICE_ID
flutter test integration_test/language_android_test.dart -d DEVICE_ID
```

APK بعد نجاح البناء: `build/app/outputs/flutter-apk/app-debug.apk`. تثبيت الاعتماديات أول مرة يحتاج وصولًا إلى خوادم Flutter/Dart وpub.dev وGoogle Maven وMaven Central وGradle. تبقى مسارات SDK المحلية في `android/local.properties` خارج Git. `python3 tool/preflight.py` فحص مستقل محدود للتعريب والهيكل، وليس بديلًا عن التحليل أو التشغيل.

## حدود الوحدات

| اليوم | المسؤولية |
|---|---|
| `lib/app` | تركيب التطبيق وسياسة اختيار اللغة. العربية افتراضية حتى على نظام إنجليزي؛ الاتجاه يُستمد من Flutter Localization. |
| `lib/features/settings` | شاشة الإعدادات وعقد تخزين التفضيل؛ لا تعتمد على Kotlin. |
| `lib/l10n` | نصوص ARB. أضف `app_<locale>.arb` بنفس المفاتيح وشغّل `flutter gen-l10n` واختبر اتجاهها. قائمة اللغات واسم كل لغة مشتقان من الموارد المولّدة. |
| `lib/platform` + مضيف Kotlin | تنفيذ التخزين على الجهاز عبر قناة ضيقة `max_editor/settings`. `SharedPreferences` خاصة بالتطبيق، مخصصة للغة **وليست مخزن أسرار**. |
| `test` / `integration_test` | اختبارات الواجهة دون جهاز، واختبار منفصل على Android يستخدم التخزين الحقيقي. |

### قرارات للمراحل التالية فقط

- يبقى نموذج المشروع والزمن والمسارات وترتيب الطبقات والعمليات غير الهدّامة مستقلًا عن Widgets وعن برامج الترميز. يحتاج النموذج لاحقًا إلى تسلسل بإصدار محدد، زمن صحيح معلوم الوحدة واختبارات للقص والتزامن والتداخل.
- Flutter يرسم الواجهة ويرسل أوامر تحرير؛ لا تعبر إطارات الفيديو الخام قنوات المنصة. Kotlin يصل إلى ExoPlayer/Media3 للتشغيل، وTransformer للصادرات التي يدعمها بالفعل. عند الحاجة يُختبر مسار معالجة يستخدم MediaCodec لفك/ترميز وMediaMuxer لتغليف المسارات، وOpenGL ES/EGL للتركيب. ليست هذه المكونات بحد ذاتها محرك Timeline. اختيار المسار النهائي مشروط بقياسات الجهاز وتطابق المعاينة والتصدير؛ لا ضمان 4K أو 60fps.
- عند تنفيذ الاستيراد استخدم منتقي النظام و`content://` وصلاحيات URI محدودة؛ لا تطلب وصولًا عامًا للتخزين. لا تعدّل الأصل، تحقّق من حجم/نوع/مدة الوسيط، واكتب الملف النهائي عبر MediaStore أو SAF بعد نجاح التصدير. لا صلاحيات تخزين أو ميكروفون في هذه المرحلة.
- عند الحاجة لخدمة خارجية: واجهة مستودع مستقلة ومحوّل شبكة اختياري، والإخفاق لا يعطل العمليات المحلية. لا تضمّن أسرار خدمة في APK أو `--dart-define`؛ أسرار المزوّد في خادم موثوق، ورموز المستخدم قصيرة العمر في تخزين محمي بـ Android Keystore. لا يوجد Backend حاليًا.
