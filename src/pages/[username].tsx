import { GetStaticProps, NextPage } from 'next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Layout } from '~/components/Layout';
import { PostSection } from '~/components/PostSection';
import { ProfileCard } from '~/components/ProfileCard';
import { PostType } from '~/server/db';
import { generateSSGHelper } from '~/server/utils/ssg.util';
import { api } from '~/utils/api.util';
import { handleErrors } from '~/utils/handle-errors.util';

export const ProfilePage: NextPage<{ username: string }> = ({ username }) => {
    const { push } = useRouter();
    const { data } = useSession();

    const { data: profileData } = api.user.getProfile.useQuery({ username }, { onError: (e) => handleErrors({ e, message: "Failed to get user!", fn: () => push('/') }), retry: 0 });

    const { data: postsData } = api.post.getPostsAllTypes.useQuery({
        id: profileData?.id ?? ''
    }, { retry: 0, enabled: !!profileData?.id, refetchOnMount: false, refetchOnWindowFocus: false, onError: (e) => handleErrors({ e, message: "Failed to get posts!", fn: () => push('/') }) });

    const isCurrentUser = data?.user.username === username ?? false;

    const pageTitle = isCurrentUser ? `profile` : username ?? 'profile';

    return (
        <Layout title={pageTitle}>
            <ProfileCard profileData={profileData} isCurrentUser={isCurrentUser} username={username} />
            <PostSection key={PostType.OUTFIT} type={PostType.OUTFIT} profileData={profileData} postsData={postsData} />
            <PostSection key={PostType.HOODIE} type={PostType.HOODIE} profileData={profileData} postsData={postsData} />
            <PostSection key={PostType.SHIRT} type={PostType.SHIRT} profileData={profileData} postsData={postsData} />
            <PostSection key={PostType.PANTS} type={PostType.PANTS} profileData={profileData} postsData={postsData} />
            <PostSection key={PostType.SHOES} type={PostType.SHOES} profileData={profileData} postsData={postsData} />
            <PostSection key={PostType.WATCH} type={PostType.WATCH} profileData={profileData} postsData={postsData} />

            <div className='h-10'></div>
        </Layout>
    );
};

export const getStaticProps: GetStaticProps = async (context) => {
    const ssg = generateSSGHelper();

    const username = context.params?.username?.toString();

    if (!username) return {
        notFound: true,
        props: {}
    }

    await ssg.user.getProfile.prefetch({ username });

    return {
        props: {
            username,
            trpcState: ssg.dehydrate(),
        },
    }
}

export const getStaticPaths = () => {
    return { paths: [], fallback: "blocking" };
}

export default ProfilePage;