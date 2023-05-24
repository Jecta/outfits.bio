import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';

import { Menu, Transition } from '@headlessui/react';

import logo from '../../public/favicon.ico';

interface Props {
    title: string;
}

export const Navbar = ({ title }: Props) => {
    const { data, status } = useSession();

    return (
        <div className="flex justify-between px-4 items-center h-20 border border-b-gray-500">
            <div className='flex items-center gap-2 text-2xl font-bold'>
                <Link href={'/'} className='w-12 h-12 relative'>
                    <Image src={logo} alt="logo" fill />
                </Link>

                <h1>/</h1>

                <h1>{title}</h1>
            </div>

            <div className='flex items-center'>
                {status === 'authenticated' && data ?
                    <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className='border rounded-md border-gray-500 px-10 h-10 items-center justify-center flex gap-1'>
                            <div className='w-8 h-8 relative'>
                                <Image src={logo} alt='avatar' fill />
                            </div>

                            <div className='font-bold hidden sm:block'>{data.user.username}</div>
                        </Menu.Button>
                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="px-1 py-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link
                                                className={`${active ? 'bg-gray-100' : 'text-gray-900'
                                                    } group flex w-full items-center rounded-md px-2 py-2 font-semibold`}
                                                href="/settings"
                                            >
                                                Settings
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link
                                                className={`${active ? 'bg-gray-100' : 'text-gray-900'
                                                    } group flex w-full items-center rounded-md px-2 py-2 font-semibold`}
                                                href={`/${data.user.username}`}
                                            >
                                                Profile
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                className={`${active ? 'bg-gray-100' : 'text-gray-900'
                                                    } group flex w-full items-center rounded-md px-2 py-2 font-semibold`}
                                                onClick={() => signOut()}
                                            >
                                                Sign Out
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            </Menu.Items>
                        </Transition>
                    </Menu>
                    :
                    <Link href={'/login'} className='border rounded-md border-gray-500 px-10 h-10 items-center justify-center flex gap-1'>
                        <div className='font-bold'>Sign In</div>
                    </Link>
                }
            </div>
        </div>
    )
}