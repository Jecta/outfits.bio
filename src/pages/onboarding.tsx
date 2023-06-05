import axios from 'axios';
import { GetServerSidePropsContext, NextPage } from 'next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import superjson from 'superjson';
import { CropModal } from '~/components/CropModal';
import { SpinnerSmall } from '~/components/Spinner';
import { useDragAndDrop } from '~/hooks/drag-and-drop.hook';
import { EditProfileInput, editProfileSchema } from '~/schemas/user.schema';
import { appRouter } from '~/server/api/root';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { api } from '~/utils/api.util';
import { handleErrors } from '~/utils/handle-errors.util';

import { zodResolver } from '@hookform/resolvers/zod';
import { createServerSideHelpers } from '@trpc/react-query/server';

export const OnboardingPage: NextPage = () => {
    const { dragActive, file, fileUrl, handleDrag, handleDrop, setFile, setFileUrl, cropModalOpen, setCropModalOpen } = useDragAndDrop();
    const { push } = useRouter();
    const { update } = useSession();

    const [loading, setLoading] = useState<boolean>(false);

    const ref = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, setValue, getValues } = useForm({
        resolver: zodResolver(editProfileSchema),
    });

    // This fetches the user's data and sets the name and username fields to the user's current name and username
    const { data } = api.user.getMe.useQuery(undefined, {
        onError: (e) => handleErrors({ e, message: "Failed to fetch you!", fn: () => push('/') }),
        onSuccess: (data) => {
            setValue('name', data.name);
            setValue('username', data.username);
        },
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    // On success, this updates the session and returns the user to their profile
    const { mutate } = api.user.editProfile.useMutation({
        onSuccess: (data) => {
            update();

            push(`/${data.username}`);
        },
        onError: (e) => handleErrors({ e, message: "Failed to edit profile!" }),
    });

    /**
     * This creates a presigned url for the image and then uploads the image to the presigned url
     * If the user didn't change their name and username from the original data, they get sent back to their profile early,
     * otherwise the edit profile mutation will send them after it finishes
     */
    const { mutate: setImage } = api.user.setImage.useMutation({
        onSuccess: async (result) => {
            await axios.put(result, file);

            if ((getValues('name') === data?.name) && (getValues('username') === data?.username)) {
                update();
                push(`/${data?.username}`)
            }
        },
        onError: (e) => handleErrors({ e, message: "Failed to set image!" }),
    });

    const handleFormSubmit = async ({ username, name }: EditProfileInput) => {
        setLoading(true);

        if (file) {
            setImage();
        }

        // If the user didn't change their name or username from the original data, do nothing
        if ((name !== data?.name) || (username !== data?.username)) mutate({
            name,
            username
        });

        setLoading(false);
    };

    /**
     * This opens the crop modal and sets the file and fileUrl
     * This only fires when the user clicks on the "Create new" button, not when the user drags and drops
     */
    const handleFileChange = (e: React.FormEvent<HTMLInputElement>) => {
        if (!e.currentTarget?.files?.length) return;

        setFile(e.currentTarget.files[0] ?? null);

        if (e.currentTarget.files[0])
            setFileUrl(URL.createObjectURL(e.currentTarget.files[0]));
        setCropModalOpen(true);
    }

    return (
        <div className='h-screen flex flex-col w-full absolute'>
            {cropModalOpen && <CropModal setFileUrl={setFileUrl} fileUrl={fileUrl} isOpen={cropModalOpen} setFile={setFile} setIsOpen={setCropModalOpen} />}
            <div className="bg-white dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 dark:text-white">
                <div className="max-w-md mx-auto">
                    <h2 className="text-2xl font-semibold font-prompt">Let's get you set up!</h2><br></br>
                    <form onSubmit={handleSubmit(handleFormSubmit)}>
                        <div className="mb-6">
                            <div className="mb-6">
                                <label htmlFor="name" className="block font-medium mb-1">
                                    Display Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded dark:bg-slate-950 dark:text-white"
                                    {...register('name')}
                                />
                            </div>

                            <label htmlFor="username" className="block font-medium mb-1">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                className="w-full px-4 py-2 border border-gray-300 rounded dark:bg-slate-950 dark:text-white"
                                {...register('username')}
                            />
                        </div>

                        <div className="mb-6">
                            <label htmlFor="avatar" className="block font-medium mb-1">
                                Avatar
                            </label>
                            <div onClick={() => ref.current?.click()} onDragEnter={handleDrag} className="relative flex items-center justify-center h-40 border border-gray-300 rounded">
                                {dragActive && <div className='absolute w-full h-full t-0 r-0 b-0 l-0' onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
                                <input
                                    ref={ref}
                                    id="avatar"
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                {file ? (
                                    <img
                                        src={fileUrl ?? ""}
                                        alt="Avatar Preview"
                                        className="h-full object-cover"
                                    />
                                ) : (
                                    <div className="cursor-pointer">
                                        Drag and drop an image or click to upload
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center justify-center gap-3 w-full h-12 bg-gray-700 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-700 text-white font-semibold rounded-md mt-4"
                        >
                            {loading && <SpinnerSmall />}
                            Continue
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// TODO: This is quite slow, not sure how to fix it
export const getServerSideProps = async (context: GetServerSidePropsContext<{ username: string }>,
) => {
    const helpers = createServerSideHelpers({
        router: appRouter,
        ctx: { db, session: null },
        transformer: superjson, // optional - adds superjson serialization
    });

    const session = await getServerAuthSession(context);

    if (session && session.user) {

        if (session.user.onboarded) {
            return {
                redirect: {
                    destination: `/${session.user.username}`,
                    permanent: false,
                }
            };
        }

        await helpers.user.getMe.prefetch();
    } else {
        return {
            props: {
            },
            redirect: {
                destination: '/login',
                permanent: false,
            }
        };
    }

    return {
        props: {
            trpcState: helpers.dehydrate(),
        }
    };
}

export default OnboardingPage;