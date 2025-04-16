package com.example.app;

import android.os.Bundle;
import android.widget.ImageView;

import com.bumptech.glide.Glide;
import com.getcapacitor.BridgeActivity;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Configura el splash screen antes de llamar a super.onCreate
        setContentView(R.layout.launch_screen);
        
        // Cargar el GIF con Glide
        ImageView spinnerView = findViewById(R.id.spinnerGif);
        Glide.with(this)
             .asGif()
             .load(R.drawable.spinner)
             .into(spinnerView);
        
        // Después llamamos a super.onCreate
        super.onCreate(savedInstanceState);
        
        // Continuar con la carga normal de la app después de un tiempo
        new android.os.Handler().postDelayed(
            new Runnable() {
                @Override
                public void run() {
                    // Cambiar al layout de Capacitor
                    load();
                }
            }, 2000); // 2 segundos para mostrar nuestro splash personalizado
    }
}