package com.sentinelpay;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.LuminanceSource;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Reader;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;

import java.io.InputStream;

/**
 * QrDecoderModule — Decodes QR codes from image files/URIs using ZXing.
 */
public class QrDecoderModule extends ReactContextBaseJavaModule {

    private static final String TAG = "QrDecoderModule";
    private final ReactApplicationContext reactContext;

    public QrDecoderModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "QrDecoderModule";
    }

    @ReactMethod
    public void decodeQrFromImage(String uriString, Promise promise) {
        try {
            Uri uri = Uri.parse(uriString);
            InputStream inputStream = reactContext.getContentResolver().openInputStream(uri);
            Bitmap bitmap = BitmapFactory.decodeStream(inputStream);

            if (inputStream != null) {
                inputStream.close();
            }

            if (bitmap == null) {
                promise.reject("DECODE_ERROR", "Failed to load image bitmap");
                return;
            }

            int width = bitmap.getWidth();
            int height = bitmap.getHeight();
            int[] pixels = new int[width * height];
            bitmap.getPixels(pixels, 0, width, 0, 0, width, height);
            bitmap.recycle();

            LuminanceSource source = new RGBLuminanceSource(width, height, pixels);
            BinaryBitmap binaryBitmap = new BinaryBitmap(new HybridBinarizer(source));

            Reader reader = new MultiFormatReader();
            Result result = reader.decode(binaryBitmap);

            if (result != null && result.getText() != null) {
                Log.d(TAG, "QR decoded successfully: " + result.getText());
                promise.resolve(result.getText());
            } else {
                promise.reject("NO_QR_FOUND", "No QR code found in image");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error decoding QR code: " + e.getMessage(), e);
            promise.reject("DECODE_FAILED", "Could not decode QR code: " + e.getMessage());
        }
    }
}
