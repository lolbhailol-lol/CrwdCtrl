import { useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import { Mountain, Loader } from 'lucide-react';

import { trekOrganizerLogin } from '../../services/api/trekOrganizer.api';

import { setTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { showAppPopup } from '../../utils/appPopup';



function resolvePostLoginPath(treks, from) {
    if (from) return from;
    // Always land on community home so organizers can pick a trek
    return '/trek-organizer';
}



export default function TrekOrganizerLoginPage() {

    const navigate = useNavigate();

    const location = useLocation();

    const [username, setUsername] = useState('');

    const [password, setPassword] = useState('');

    const [error, setError] = useState('');

    const [loading, setLoading] = useState(false);



    const submit = async (e) => {

        e.preventDefault();

        setError('');

        setLoading(true);

        try {

            const data = await trekOrganizerLogin(username, password);

            setTrekOrganizerSession({

                token: data.token,

                organizer: data.organizer,

                community: data.community || null,

                treks: data.treks || [],

            });

            showAppPopup({
                title: 'Signed in successfully',
                message: 'Welcome to the organizer portal.',
                tone: 'login',
            });

            navigate(resolvePostLoginPath(data.treks, location.state?.from), { replace: true });

        } catch (err) {

            setError(err.message || 'Login failed');

        } finally {

            setLoading(false);

        }

    };



    return (

        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">

            <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161718] p-6 sm:p-8 shadow-2xl">

                <div className="flex items-center gap-3 mb-6">

                    <div className="size-12 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">

                        <Mountain className="text-[#0ECCEE]" size={26} />

                    </div>

                    <div>

                        <h1 className="text-xl sm:text-2xl font-bold text-white">Community Organizer</h1>

                        <p className="text-xs sm:text-sm text-gray-500">Sign in to manage your community treks</p>

                    </div>

                </div>



                {error ? (

                    <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">{error}</div>

                ) : null}



                <form onSubmit={submit} className="space-y-4">

                    <div>

                        <label htmlFor="organizer-username" className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>

                        <input

                            id="organizer-username"

                            type="text"

                            inputMode="text"

                            autoCapitalize="none"

                            autoCorrect="off"

                            value={username}

                            onChange={(e) => setUsername(e.target.value)}

                            required

                            autoComplete="username"

                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"

                            placeholder="Username from admin"

                        />

                        <p className="text-[11px] text-gray-600 mt-1.5">Use the username assigned to you by CrwdCtrl admin.</p>

                    </div>

                    <div>

                        <label htmlFor="organizer-password" className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>

                        <input

                            id="organizer-password"

                            type="password"

                            value={password}

                            onChange={(e) => setPassword(e.target.value)}

                            required

                            autoComplete="current-password"

                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"

                            placeholder="••••••••"

                        />

                    </div>

                    <button

                        type="submit"

                        disabled={loading}

                        className="w-full min-h-[48px] py-3.5 rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"

                    >

                        {loading ? <Loader className="animate-spin" size={20} /> : null}

                        Sign in

                    </button>

                </form>

                <p className="text-[11px] text-gray-600 mt-5 text-center leading-relaxed">

                    Username and password are provided by CrwdCtrl admin. No self-registration.

                </p>

            </div>

        </div>

    );

}

