import { Injectable, inject } from "@angular/core";
import { Auth, authState, signOut } from "@angular/fire/auth";
import { Observable, map } from "rxjs";

@Injectable({
    providedIn: 'root',
})
export class AuthStateService {
    private _auth = inject(Auth);

    get authState$(): Observable<boolean> {
        return authState(this._auth).pipe(
            map(user => !!user)
        );
    }

    logOut() {
        return signOut(this._auth);
    }
}
