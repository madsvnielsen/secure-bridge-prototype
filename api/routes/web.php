<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', fn() => response()->json(['ok' => true]));
Route::post('/pair', fn(\Illuminate\Http\Request $r) => response()->json(['received' => $r->all()]));
